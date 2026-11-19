from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.skills import build_terms, find_in_text, normalize_label

client = TestClient(app)
TERMS = tuple(build_terms([
    "Microsoft Excel", "Microsoft Word", "Structured query language SQL", "R", "Python",
    "Microsoft Power BI",
]))


def test_aliases_cover_vendor_names_and_acronyms() -> None:
    assert normalize_label("Excel", TERMS) == ("Microsoft Excel", "alias")
    assert normalize_label("SQL", TERMS) == ("Structured query language SQL", "alias")
    assert normalize_label("python", TERMS) == ("Python", "exact")
    assert normalize_label("Power BI dashboards", TERMS) == ("Microsoft Power BI", "alias")
    assert normalize_label("Gardening", TERMS) == (None, "none")


def test_everyday_words_are_not_treated_as_software() -> None:
    text = "I can word a report, read R output, and our outlook is good. Used excel daily."
    found = find_in_text(text, TERMS)
    assert "Microsoft Word" not in found
    assert "Microsoft Excel" not in found  # single-word aliases are case-sensitive
    assert found == ["R"]


def test_normalize_endpoint(career_db: Path) -> None:
    body = client.post(
        "/api/v1/careers/skills/normalize", json={"skills": ["Excel", "Epic Systems", "Knitting"]}
    ).json()
    assert [(m["onet_name"], m["match"]) for m in body["matches"]] == [
        ("Microsoft Excel", "alias"), ("Epic Systems", "exact"), (None, "none"),
    ]


def test_resume_draft_adds_onet_software_mentioned_outside_skills(
    career_db: Path, tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    content = (
        b"Experience\nCharge nurse documenting care in Epic Systems and AutoCAD drawings\n"
        b"Skills\nPython, Excel"
    )
    response = client.post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )
    skills = response.json()["draft"]["skills"]
    assert skills[:2] == ["Python", "Excel"]
    assert "Epic Systems" in skills
    assert "Autodesk AutoCAD" in skills
    assert "Microsoft Excel" not in skills  # already represented as "Excel"
