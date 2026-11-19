import shutil
import sqlite3
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.careers.build import ATTRIBUTION, OnetSourceError, build_career_db
from app.main import app
from tests.conftest import ONET_FIXTURE

client = TestClient(app)


def test_build_pivots_scales_and_drops_flagged_ratings(career_db: Path) -> None:
    with sqlite3.connect(career_db) as db:
        rows = db.execute(
            "SELECT soc, kind, name, importance, level FROM skill_ratings ORDER BY soc, kind, name"
        ).fetchall()
        zone = db.execute("SELECT job_zone FROM occupations WHERE soc='15-2051.00'").fetchone()
        related = db.execute("SELECT related_soc FROM related").fetchall()
    assert ("15-2051.00", "essential", "Mathematics", 4.25, 5.12) in rows
    # Recommend Suppress / Not Relevant rows are dropped, keeping the other scale.
    assert ("29-1141.00", "essential", "Active Listening", 4.0, None) in rows
    assert ("47-2111.00", "essential", "Mathematics", 3.1, None) in rows
    assert zone == (4,)
    assert ("99-9999.00",) not in related


def test_build_reads_a_zip_with_nested_folder(tmp_path: Path) -> None:
    archive = tmp_path / "db_31_0_csv.zip"
    with zipfile.ZipFile(archive, "w") as out:
        for csv_file in ONET_FIXTURE.glob("*.csv"):
            out.write(csv_file, f"db_31_0_csv/{csv_file.name}")
    counts = build_career_db(archive, tmp_path / "careers.db")
    assert counts["occupations"] == 3
    assert counts["job_titles"] == 9


def test_build_reports_missing_files_and_columns(tmp_path: Path) -> None:
    source = tmp_path / "onet"
    shutil.copytree(ONET_FIXTURE, source)
    (source / "knowledge.csv").unlink()
    with pytest.raises(OnetSourceError, match="knowledge.csv"):
        build_career_db(source, tmp_path / "careers.db")

    shutil.copy(ONET_FIXTURE / "knowledge.csv", source / "knowledge.csv")
    (source / "job_zones.csv").write_text("O*NET-SOC Code,Title\n", encoding="utf-8")
    with pytest.raises(OnetSourceError, match="Job Zone"):
        build_career_db(source, tmp_path / "careers.db")
    assert not (tmp_path / "careers.db").exists()


def test_routes_explain_when_data_is_not_built() -> None:
    response = client.get("/api/v1/careers/search", params={"q": "nurse"})
    assert response.status_code == 503
    assert "build_career_db.py" in response.json()["detail"]


def test_search_ranks_exact_then_prefix_then_contains(career_db: Path) -> None:
    body = client.get("/api/v1/careers/search", params={"q": "data"}).json()
    assert [r["soc"] for r in body["results"]] == ["15-2051.00", "47-2111.00"]
    assert body["results"][1]["matched_title"] == "Data Center Electrician"
    assert body["source"]["attribution"] == ATTRIBUTION

    rn = client.get("/api/v1/careers/search", params={"q": "rn"}).json()["results"]
    assert rn[0]["title"] == "Registered Nurses"


def test_search_treats_like_wildcards_literally(career_db: Path) -> None:
    body = client.get("/api/v1/careers/search", params={"q": "%_"}).json()
    assert body["results"] == []


def test_occupation_detail_has_required_transferable_and_software(career_db: Path) -> None:
    body = client.get("/api/v1/careers/15-2051.00").json()
    assert body["title"] == "Data Scientists"
    assert body["job_zone"]["zone"] == 4
    assert body["job_zone"]["name"].startswith("Job Zone Four")
    essential = {s["name"]: s for s in body["essential_skills"]}
    assert essential["Mathematics"]["required"] is True
    assert essential["Critical Thinking"]["required"] is False
    assert body["transferable_skills"][0]["name"] == "Programming"
    assert body["software"][0]["in_demand"] is True
    assert [r["soc"] for r in body["related"]] == ["29-1141.00", "47-2111.00"]
    assert "Machine Learning Scientist" in body["alternate_titles"]


def test_occupation_rejects_bad_codes_and_reports_unknown(career_db: Path) -> None:
    assert client.get("/api/v1/careers/not-a-code").status_code == 422
    assert client.get("/api/v1/careers/11-1111.00").status_code == 404


def test_explore_maps_survey_category_to_occupations(career_db: Path) -> None:
    body = client.get("/api/v1/careers/explore/Trades").json()
    assert [r["soc"] for r in body["results"]] == ["47-2111.00"]
    assert client.get("/api/v1/careers/explore/Astronaut").status_code == 422
