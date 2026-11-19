"""Only synthetic data. Tests exercise both entry routes through the same contract."""

from io import BytesIO
from uuid import uuid4
from zipfile import ZipFile

import fitz
import pytest
from docx import Document
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import app
from app.schemas.character import CharacterProfile

client = TestClient(app)
TEXT = """Jordan Rivera
jordan@example.invalid
EDUCATION
Example High School
Relevant coursework: Biology; Graphic Design
VOLUNTEER EXPERIENCE
Community Garden Volunteer
Helped organize a neighborhood planting day.
PROJECTS
School recycling tracker
Built a spreadsheet to track recycling.
SKILLS
Excel, Research, Communication, Excel
INTERESTS
Ecology; Design
HOBBIES
Drawing; Cycling
CERTIFICATIONS
First Aid
"""


def extract(data=TEXT.encode(), name="resume.txt"):
    return client.post("/api/v1/characters/extract", files={"file": (name, data)})


def test_resume_draft_uses_canonical_schema_and_requires_review(tmp_path, monkeypatch):
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    response = extract()
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    profile = CharacterProfile.model_validate(response.json()["profile"])
    assert profile.life_stage is None  # Do not infer someone's stage from their school.
    assert profile.approval_status == "draft"
    assert {item.category for item in profile.entries} == {
        "education",
        "experience",
        "classes",
        "projects",
        "skills",
        "interests",
        "hobbies",
        "certifications",
    }
    assert all(item.source == "resume" and item.status == "suggested" for item in profile.entries)
    assert all(item.evidence for item in profile.entries)
    assert "jordan@example" not in response.text
    assert sum(item.title == "Excel" for item in profile.entries) == 1
    assert list(tmp_path.iterdir()) == []


def test_manual_and_reviewed_resume_profiles_approve_through_same_endpoint():
    imported = extract().json()["profile"]
    imported.update(name="Jordan", life_stage="high_school")
    for entry in imported["entries"]:
        entry["status"] = "confirmed"
    manual = CharacterProfile(name="Alex", life_stage="college").model_dump(mode="json")
    for profile in (manual, imported):
        response = client.post("/api/v1/characters/approve", json=profile)
        assert response.status_code == 200
        assert response.json()["approval_status"] == "approved"
        assert response.json()["entries"] == profile["entries"]


def test_cannot_approve_unreviewed_suggestions_even_with_forged_approval_status():
    profile = extract().json()["profile"]
    profile.update(name="Jordan", life_stage="high_school")
    for status in ("draft", "approved"):
        profile["approval_status"] = status
        response = client.post("/api/v1/characters/approve", json=profile)
        assert response.status_code == 422
        assert "Community Garden" not in response.text


@pytest.mark.parametrize(
    "change",
    [
        {"name": "   "},
        {"life_stage": None},
        {"schema_version": "9.0"},
        {"unknown": "private-content"},
        {"name": "x" * 81},
        {"goal": "x" * 501},
    ],
)
def test_invalid_profiles_rejected_without_echoing_input(change):
    profile = CharacterProfile(name="Jordan", life_stage="high_school").model_dump(mode="json")
    profile.update(change)
    response = client.post("/api/v1/characters/approve", json=profile)
    assert response.status_code == 422
    assert "private-content" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_duplicate_ids_empty_entries_and_oversized_lists_rejected():
    profile = CharacterProfile(name="Jordan", life_stage="college").model_dump(mode="json")
    entry = {"id": str(uuid4()), "category": "skills", "title": "Python"}
    for entries in (
        [entry, entry],
        [{**entry, "title": "  "}],
        [{**entry, "details": "x" * 2001}],
        [{**entry, "id": str(uuid4())} for _ in range(201)],
    ):
        response = client.post("/api/v1/characters/approve", json={**profile, "entries": entries})
        assert response.status_code == 422


def test_more_than_ten_skills_are_preserved_without_degree_ranking():
    skills = [f"Skill {number}" for number in range(15)]
    response = extract(("EDUCATION\nBusiness Analytics\nSKILLS\n" + ", ".join(skills)).encode())
    assert [
        item["title"]
        for item in response.json()["profile"]["entries"]
        if item["category"] == "skills"
    ] == skills


def test_inline_sections_and_long_content_stay_reviewable():
    response = extract(
        ("Skills: Python, Excel\nHobbies: Cycling\nPROJECTS\n" + "a" * 5000).encode()
    )
    assert response.status_code == 200
    entries = response.json()["profile"]["entries"]
    assert any(item["title"] == "Python" for item in entries)
    assert sum(len(item["details"]) for item in entries if item["category"] == "projects") >= 5000


def test_unrecognized_text_returns_helpful_empty_draft():
    response = extract(b"This has no recognizable sections.")
    assert response.status_code == 200
    assert response.json()["profile"]["entries"] == []
    assert any("No recognized sections" in warning for warning in response.json()["warnings"])


@pytest.mark.parametrize(
    "filename,data",
    [
        ("empty.txt", b""),
        ("fake.pdf", b"Not a PDF"),
        ("fake.docx", b"PK\x03\x04broken"),
        ("bad.exe", b"executable"),
        ("binary.txt", b"\xff\xfe"),
        ("large.txt", b"x" * 100001),
    ],
    ids=["empty", "spoofed-pdf", "broken-docx", "unsupported", "binary", "too-much-text"],
)
def test_bad_uploads_are_safe_and_cleaned(filename, data, tmp_path, monkeypatch):
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    response = extract(data, filename)
    assert response.status_code == 422
    assert list(tmp_path.iterdir()) == []


def test_upload_size_limit():
    app.dependency_overrides[get_settings] = lambda: Settings(max_upload_bytes=100)
    try:
        assert extract(b"x" * 101).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_real_pdf_and_docx_extract_into_the_same_schema(tmp_path, monkeypatch):
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    with fitz.open() as pdf:
        page = pdf.new_page()
        page.insert_text((72, 72), TEXT)
        pdf_bytes = pdf.tobytes()
    document = Document()
    for line in TEXT.splitlines():
        document.add_paragraph(line)
    buffer = BytesIO()
    document.save(buffer)
    for name, data in (("resume.pdf", pdf_bytes), ("resume.docx", buffer.getvalue())):
        response = extract(data, name)
        assert response.status_code == 200
        profile = CharacterProfile.model_validate(response.json()["profile"])
        assert any(entry.title == "Excel" for entry in profile.entries)
        assert list(tmp_path.iterdir()) == []


def test_scanned_encrypted_and_overlong_pdfs_rejected():
    with fitz.open() as pdf:
        pdf.new_page()
        assert extract(pdf.tobytes(), "scan.pdf").status_code == 422
        encrypted = pdf.tobytes(
            encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret"
        )
        assert extract(encrypted, "encrypted.pdf").status_code == 422
        for _ in range(40):
            pdf.new_page()
        assert extract(pdf.tobytes(), "long.pdf").status_code == 422


def test_docx_zip_bomb_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        for index in range(501):
            archive.writestr(str(index), "x")
    assert extract(buffer.getvalue(), "many.docx").status_code == 422
    assert list(tmp_path.iterdir()) == []
