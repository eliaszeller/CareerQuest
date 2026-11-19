from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

pytest.importorskip("sklearn")

from app.careers.postings import build_postings  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.schemas.career import ExplanationFact  # noqa: E402
from app.services.career_explain import validate_points  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "linkedin_mini"
client = TestClient(app)
REQUEST = {"soc": "15-2051.00", "skills": ["Python", "Mathematics"], "goal": "Switch careers"}


@pytest.fixture
def market_db(career_db: Path) -> Path:
    build_postings(FIXTURE, career_db, None)
    return career_db


def _fake_model(monkeypatch, content: str, calls: list | None = None) -> None:
    monkeypatch.setenv("TEXT_MODEL_URL", "http://model.test")
    get_settings.cache_clear()

    def post(url, json, timeout):  # noqa: A002 - mirrors httpx.post
        if calls is not None:
            calls.append(json)
        request = httpx.Request("POST", url)
        return httpx.Response(200, request=request,
                              json={"choices": [{"message": {"content": content}}]})

    monkeypatch.setattr("app.services.text_model.httpx.post", post)


def test_template_explanation_cites_real_facts(market_db) -> None:
    body = client.post("/api/v1/careers/explain", json=REQUEST).json()
    assert body["generated_by"] == "template"
    fact_ids = {fact["id"] for fact in body["facts"]}
    assert len(body["points"]) >= 2
    assert all(set(point["facts"]) <= fact_ids for point in body["points"])
    texts = " ".join(fact["text"] for fact in body["facts"])
    assert "Middle half of posted salaries" in texts
    assert "Skills you already show: " in texts and "Python" in texts
    assert len(body["sources"]) == 2


def test_model_explanation_is_used_when_grounded(market_db, monkeypatch) -> None:
    calls: list = []
    _fake_model(monkeypatch, "<think>hmm</think>```json\n{\"summary\": \"A good fit to explore.\","
                " \"points\": [{\"text\": \"You already show Python.\", \"facts\": [\"F8\"]},"
                " {\"text\": \"Build SQL evidence next.\", \"facts\": [\"F9\", \"F99\"]},"
                " {\"text\": \"Most roles pay $999K.\", \"facts\": [\"F5\"]}]}\n```", calls)
    body = client.post("/api/v1/careers/explain", json=REQUEST).json()
    assert body["generated_by"] == "model"
    assert body["summary"] == "A good fit to explore."
    # The unknown fact id is dropped and the invented salary point is rejected.
    assert [p["facts"] for p in body["points"]] == [["F8"], ["F9"]]
    prompt = calls[0]["messages"][1]["content"]
    assert "Switch careers" in prompt and "F1." in prompt


def test_unreachable_or_ungrounded_model_falls_back(market_db, monkeypatch) -> None:
    _fake_model(monkeypatch, "Sorry, I can't help with that.")
    assert client.post("/api/v1/careers/explain", json=REQUEST).json()["generated_by"] == "template"

    monkeypatch.setenv("TEXT_MODEL_URL", "http://model.test")
    get_settings.cache_clear()

    def down(*args, **kwargs):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr("app.services.text_model.httpx.post", down)
    assert client.post("/api/v1/careers/explain", json=REQUEST).json()["generated_by"] == "template"


def test_validate_points_checks_numbers_against_cited_facts() -> None:
    facts = [ExplanationFact(id="F1", text="1,234 job postings were mapped.", source="x"),
             ExplanationFact(id="F2", text="Middle half: $110K to $155K.", source="x")]
    points = validate_points([
        {"text": "About 1,234 postings matched.", "facts": ["F1"]},
        {"text": "Pay runs $110K to $155K.", "facts": ["F1"]},  # number not in F1
        {"text": "Pay runs $110K to $155K.", "facts": ["F2"]},
        {"text": "No citation."},
        "not a point",
    ], facts)
    assert [p.facts for p in points] == [["F1"], ["F2"]]


def test_explain_unknown_occupation_and_missing_data(career_db) -> None:
    assert client.post("/api/v1/careers/explain", json={"soc": "99-9999.00"}).status_code == 404
