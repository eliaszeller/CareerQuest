import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("sklearn")

from app.careers.postings import (  # noqa: E402
    PostingsSourceError,
    annual_salary,
    build_postings,
    normalize_title,
)
from app.core.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "linkedin_mini"
client = TestClient(app)


@pytest.fixture
def postings_db(career_db: Path, tmp_path: Path, monkeypatch) -> dict:
    index = tmp_path / "postings_index.joblib"
    counts = build_postings(FIXTURE, career_db, index)
    monkeypatch.setenv("POSTINGS_INDEX_PATH", str(index))
    get_settings.cache_clear()
    return counts


def test_title_normalizing_and_salary_annualizing() -> None:
    assert normalize_title("Senior Data Scientist II (Remote)") == "data scientist"
    assert normalize_title("Registered Nurse - ICU") == "registered nurse"
    assert normalize_title("Registered Nurses") == "registered nurse"
    assert annual_salary({"pay_period": "HOURLY", "med_salary": "50"}) == 104_000
    assert annual_salary({"pay_period": "YEARLY", "min_salary": "80000",
                          "max_salary": "100000"}) == 90_000
    assert annual_salary({"normalized_salary": "90000", "currency": "EUR"}) is None
    assert annual_salary({"normalized_salary": "5"}) is None


def test_build_maps_titles_and_summarizes_market(postings_db, career_db: Path) -> None:
    assert postings_db["postings_read"] == 9
    assert postings_db["postings_mapped"] == 8  # the basket weaver has no O*NET match
    with sqlite3.connect(career_db) as db:
        socs = dict(db.execute("SELECT job_id, soc FROM postings"))
        market = db.execute(
            "SELECT postings, salary_n, salary_median FROM occupation_market "
            "WHERE soc = '15-2051.00'").fetchone()
    assert socs["5"] == "29-1141.00" and socs["7"] == "47-2111.00"
    assert "8" not in socs
    assert market == (4, 3, 140000.0)  # EUR salary excluded


def test_occupation_detail_includes_market(postings_db) -> None:
    market = client.get("/api/v1/careers/15-2051.00").json()["market"]
    assert market["postings"] == 4
    assert market["salary"]["median"] == 140000
    preferred = {p["name"]: p for p in market["preferred_skills"]}
    assert preferred["Python"]["share"] == 1.0
    assert preferred["Microsoft Power BI"]["share"] == 0.5
    assert len(market["sample_postings"]) == 3
    assert "CC BY-SA 4.0" in market["source"]["license"]


def test_market_is_absent_before_postings_are_built(career_db) -> None:
    assert client.get("/api/v1/careers/15-2051.00").json()["market"] is None
    response = client.post("/api/v1/careers/postings/search", json={"query": "python"})
    assert response.status_code == 503


def test_posting_search_uses_index_and_soc_filter(postings_db) -> None:
    body = client.post("/api/v1/careers/postings/search",
                       json={"query": "python machine learning experiments"}).json()
    assert body["method"] == "tfidf_index"
    assert body["results"][0]["job_id"] == "3"
    nurses = client.post("/api/v1/careers/postings/search",
                         json={"query": "epic care", "soc": "29-1141.00"}).json()["results"]
    assert {p["job_id"] for p in nurses} == {"4", "5"}


def test_posting_search_falls_back_to_titles(postings_db, monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("POSTINGS_INDEX_PATH", str(tmp_path / "missing.joblib"))
    get_settings.cache_clear()
    body = client.post("/api/v1/careers/postings/search", json={"query": "nurse"}).json()
    assert body["method"] == "title_match"
    assert {p["job_id"] for p in body["results"]} == {"4", "6"}


def test_skill_gap_marks_have_and_missing(postings_db) -> None:
    body = client.post("/api/v1/careers/gap", json={
        "soc": "15-2051.00", "skills": ["Python", "Excel", "Mathematics", "Project management"],
    }).json()
    items = {(i["kind"], i["name"]): i for i in body["items"]}
    assert items[("required", "Mathematics")]["have"] is True
    assert ("required", "Critical Thinking") not in items  # importance below 3
    assert items[("software", "Python")]["have"] is True
    assert items[("software", "Microsoft Excel")]["matched_by"] == "Excel"
    assert items[("software", "R")]["have"] is False  # never a substring match
    assert 0 < body["coverage"] < 1
    assert len(body["sources"]) == 2


def test_build_requires_career_db_and_postings_file(tmp_path: Path) -> None:
    with pytest.raises(PostingsSourceError, match="build_career_db"):
        build_postings(FIXTURE, tmp_path / "missing.db", None)


def test_title_mapper_contains_typos_and_guards_head_noun(career_db: Path) -> None:
    from app.careers.postings import TitleMapper

    with sqlite3.connect(career_db) as db:
        mapper = TitleMapper(db, threshold=0.6)
    titles = [normalize_title(t) for t in (
        "Registered Nurse ICU", "Registerd Nurse", "Machine Learning Engineer",
        "Data Science Mgr", "Underwater Basket Weaver",
    )]
    result = mapper.map_many(titles)
    assert result["registered nurse icu"][:2] == ("29-1141.00", 0.95)
    assert result["registerd nurse"][0] == "29-1141.00"
    assert "machine learning engineer" not in result  # not a "scientist"
    assert "data science manager" not in result
    assert "underwater basket weaver" not in result


def test_fuzzy_matches_reject_added_qualifiers_and_generic_titles() -> None:
    from app.careers.postings import TitleMapper

    assert not TitleMapper._plausible("associate", "it associate")
    assert not TitleMapper._plausible("team member", "sale team member")
    assert not TitleMapper._plausible("product owner", "owner")
    assert not TitleMapper._plausible("summer intern", "intern")
    assert TitleMapper._plausible("registerd nurse", "registered nurse")
    assert TitleMapper._plausible("frontend developer", "front end developer")
    assert normalize_title("HR Generalist") == "human resource generalist"
    assert normalize_title("LPN") == "licensed practical nurse"


def test_build_writes_mapping_report(postings_db, career_db: Path) -> None:
    report = (career_db.parent / "postings_mapping_report.csv").read_text(encoding="utf-8")
    assert "unmapped,underwater basket weaver,1" in report
    assert postings_db["mapped_exact"] + postings_db["mapped_fuzzy"] == 8
