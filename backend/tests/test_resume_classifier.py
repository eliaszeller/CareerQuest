import csv
import json
import random
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("sklearn")

from app.main import app  # noqa: E402
from app.resume.training import clean_text, load_resumes, train  # noqa: E402
from tests.conftest import use_resume_model  # noqa: E402

VOCAB = {
    "INFORMATION-TECHNOLOGY": "python sql network servers cloud software developer debugging api",
    "HEALTHCARE": "patient nursing clinical care medication charting hospital triage vitals",
    "CONSTRUCTION": "site foreman concrete framing blueprints safety crew scaffolding osha",
}


def write_resumes(path: Path, per_category: int = 12) -> None:
    rng = random.Random(7)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["ID", "Resume_str", "Resume_html", "Category"])
        row_id = 1
        for category, words in VOCAB.items():
            for _ in range(per_category):
                text = " ".join(rng.choices(words.split(), k=40) + ["experience", "team"])
                writer.writerow([row_id, text, "<div></div>", category])
                row_id += 1
        writer.writerow([row_id, text, "<div></div>", category])  # exact duplicate


def test_clean_text_and_dedup(tmp_path: Path) -> None:
    assert clean_text("Built C++ & Python APIs!") == "built c++ python apis"
    source = tmp_path / "Resume.csv"
    write_resumes(source)
    texts, labels = load_resumes(source)
    assert len(texts) == 36
    assert sorted(set(labels)) == sorted(VOCAB)


@pytest.fixture
def trained_model(tmp_path: Path, monkeypatch) -> Path:
    source = tmp_path / "Resume.csv"
    write_resumes(source)
    model = tmp_path / "models" / "resume_classifier.joblib"
    result = train(source, model)
    assert result.metrics["logistic_regression"]["accuracy"] >= 0.9
    assert json.loads(result.metrics_path.read_text())["categories"] == 3
    use_resume_model(monkeypatch, model)
    return model


def upload(text: bytes):
    return TestClient(app).post(
        "/api/v1/characters/extract",
        files={"file": ("resume.txt", BytesIO(text), "text/plain")},
    )


def test_extract_omits_suggestions_without_model_or_data() -> None:
    response = upload(b"Experience\nStaff nurse on a busy ward")
    assert response.status_code == 200
    assert response.json()["career_suggestions"] is None


def test_extract_suggests_category_and_occupations(trained_model, career_db) -> None:
    response = upload(
        b"Experience\nRegistered nurse giving patient care, medication and triage\n"
        b"Skills\nActive listening, Epic Systems"
    )
    suggestions = response.json()["career_suggestions"]
    assert suggestions["categories"][0]["category"] == "HEALTHCARE"
    assert suggestions["categories"][0]["label"] == "Healthcare"
    assert len(suggestions["categories"]) == 3
    occupations = suggestions["occupations"]
    assert occupations[0]["soc"] == "29-1141.00"
    assert occupations[0]["reason"] == "similar_wording"
    assert suggestions["source"]["name"].startswith("O*NET")
    assert "not a judgment" in suggestions["note"]


def test_occupation_matching_works_without_a_trained_model(career_db) -> None:
    response = upload(b"Experience\nData scientist building machine learning in Python")
    suggestions = response.json()["career_suggestions"]
    assert suggestions["categories"] == []
    assert suggestions["occupations"][0]["title"] == "Data Scientists"
