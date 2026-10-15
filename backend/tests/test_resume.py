from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_txt_resume_returns_reviewable_draft(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr("tempfile.tempdir", str(tmp_path))
    content = (
        b"Education\nState University, BA\nExperience\n"
        b"Analyst Intern\nSkills\nPython, Excel, SQL"
    )

    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["review_required"] is True
    assert body["draft"]["education"] == ["State University, BA"]
    assert set(body["draft"]["skills"]) >= {"Python", "Excel", "SQL"}
    assert list(tmp_path.iterdir()) == []


def test_extension_spoof_is_rejected() -> None:
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.pdf", BytesIO(b"This is plain text"), "application/pdf")},
    )
    assert response.status_code == 422
    assert "does not match" in response.json()["detail"]


def test_unsupported_file_is_rejected() -> None:
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.png", BytesIO(b"fake"), "image/png")},
    )
    assert response.status_code == 422


def test_professional_experience_heading_is_recognized() -> None:
    content = (
        b"EDUCATION\nState University\nPROFESSIONAL EXPERIENCE\n"
        b"Data Analyst | Example Health | 2023 - Present\n"
        b"Built dashboards for operational leaders.\nTECHNICAL SKILLS\nPython, SQL"
    )
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )
    assert response.status_code == 200
    experience = response.json()["draft"]["experience"]
    assert experience == [
        "Data Analyst | Example Health | 2023 - Present",
        "Built dashboards for operational leaders.",
    ]


def test_certifications_exclude_following_resume_sections() -> None:
    content = (
        b"CERTIFICATIONS\nLean Six Sigma White, Yellow and Green Belts | NREMT | HIPAA | "
        b"BLS/CPR/AED/First Aid\nTECHNICAL SOLUTIONS | DATA ANALYTICS\n"
        b"Python, SQL, workflow troubleshooting"
    )
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )
    assert response.status_code == 200
    assert response.json()["draft"]["certifications"] == [
        "Lean Six Sigma White, Yellow, and Green Belts",
        "NREMT",
        "HIPAA",
        "BLS",
        "CPR",
        "AED",
        "First Aid",
    ]


def test_all_explicit_categorized_skills_are_extracted() -> None:
    content = (
        b"TECHNICAL SKILLS\n"
        b"Technical: Python (pandas, scikit-learn), SQL, REST APIs, data validation\n"
        b"Healthcare and AI: clinical documentation, NLP, machine learning\n"
        b"Customer and operations: stakeholder communication, issue resolution, "
        b"implementation support\nPROJECTS\nExample project"
    )
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )

    assert response.status_code == 200
    skills = response.json()["draft"]["skills"]
    assert "Python" in skills
    assert "REST APIs" in skills
    assert "clinical documentation" in skills
    assert "implementation support" in skills
    assert not any(skill.startswith("Technical:") for skill in skills)


def test_skills_are_limited_and_ranked_for_analytics_education() -> None:
    content = (
        b"EDUCATION\nExample University\nMS, Business Analytics (Healthcare Analytics Focus)\n"
        b"TECHNICAL SKILLS\n"
        b"Customer: leadership, sales, marketing, customer service, communication\n"
        b"Technical: Python, SQL, Excel, machine learning, NLP, data quality, "
        b"data validation, healthcare informatics, process automation, REST APIs\n"
        b"PROJECTS\nExample project"
    )
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )

    skills = response.json()["draft"]["skills"]
    assert len(skills) == 10
    assert skills[:3] == ["Python", "SQL", "Excel"]
    assert "healthcare informatics" in skills
    assert "sales" not in skills


def test_tool_skills_are_cleaned_and_deduplicated() -> None:
    content = (
        b"EDUCATION\nExample University\nMS, Business Analytics\n"
        b"TECHNICAL SKILLS\nPython (pandas, scikit-learn), SQL, "
        b"Excel (advanced formulas, PivotTables, VLOOKUP, VBA/macros), NLP, "
        b"data quality and validation, data visualization, modeling, JavaScript\n"
        b"EXPERIENCE\nUsed Python and Excel for reporting"
    )
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )

    skills = response.json()["draft"]["skills"]
    assert "Python" in skills
    assert "Python (pandas, scikit-learn)" not in skills
    assert sum(skill.casefold().startswith("python") for skill in skills) == 1
    assert "Excel" in skills
    assert "Excel (advanced formulas, PivotTables, VLOOKUP, VBA/macros)" not in skills
    assert sum(skill.casefold().startswith("excel") for skill in skills) == 1


def test_name_is_extracted_from_resume_header() -> None:
    content = b"ELIAS ZELLER\nelias@example.com\nEDUCATION\nExample University\n"
    response = TestClient(app).post(
        "/api/v1/resume/extract",
        files={"file": ("resume.txt", BytesIO(content), "text/plain")},
    )

    assert response.json()["draft"]["name"] == "Elias Zeller"
