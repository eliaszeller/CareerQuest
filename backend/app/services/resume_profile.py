from __future__ import annotations

import re

from app.schemas.resume import ResumeDraft

SKILL_TERMS = {
    "Python", "JavaScript", "TypeScript", "React", "SQL", "Excel", "Tableau",
    "Power BI", "FastAPI", "Leadership", "Communication", "Project Management",
    "Data Analysis", "Customer Service", "Marketing", "Sales", "Research",
}

SECTION_ALIASES = {
    "education": "education",
    "academic background": "education",
    "academic experience": "education",
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "relevant experience": "experience",
    "employment history": "experience",
    "work history": "experience",
    "career history": "experience",
    "skills": "skills",
    "technical skills": "skills",
    "core competencies": "skills",
    "certifications": "certifications",
    "licenses and certifications": "certifications",
    "projects": "projects",
    "selected projects": "projects",
    "academic projects": "projects",
    "summary": "other",
    "professional summary": "other",
    "objective": "other",
    "awards": "other",
    "activities": "other",
    "volunteer experience": "experience",
}

CERTIFICATION_PATTERNS = (
    (
        r"Lean Six Sigma White(?:,| and)? Yellow(?:,? and)? Green Belts?",
        "Lean Six Sigma White, Yellow, and Green Belts",
    ),
    (r"Lean Six Sigma (?:White|Yellow|Green|Black) Belt", None),
    (r"\bNREMT\b", "NREMT"),
    (r"\bHIPAA(?: training| certification)?\b", "HIPAA"),
    (r"\bBLS\b", "BLS"),
    (r"\bCPR\b", "CPR"),
    (r"\bAED\b", "AED"),
    (r"\bFirst Aid\b", "First Aid"),
    (r"\bPMP\b", "PMP"),
    (r"\bCertified ScrumMaster\b|\bCSM\b", "Certified ScrumMaster (CSM)"),
    (r"\bCompTIA (?:A\+|Network\+|Security\+)\b", None),
    (r"\bAWS Certified [A-Za-z -]+", None),
    (r"\bMicrosoft Certified: [A-Za-z0-9 &-]+", None),
    (
        r"\bGoogle (?:Data Analytics|Project Management|Cybersecurity) Professional Certificate\b",
        None,
    ),
)


def _lines(text: str) -> list[str]:
    lines: list[str] = []
    for raw_line in text.replace("\uf0b7", "•").splitlines():
        stripped = raw_line.strip()
        if not stripped:
            continue
        if re.match(r"^[•*]", stripped):
            bullet_text = re.sub(r"^[•*\s]+", "", stripped)
            lines.append(f"• {bullet_text}")
        else:
            lines.append(re.sub(r"^-\s+", "", stripped))
    return lines


def _heading_for(line: str) -> str | None:
    normalized = re.sub(r"[^a-z& ]", "", line.lower()).replace("&", "and")
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if normalized in SECTION_ALIASES:
        return SECTION_ALIASES[normalized]

    words = normalized.split()
    letters = [character for character in line if character.isalpha()]
    uppercase_ratio = sum(character.isupper() for character in letters) / max(len(letters), 1)
    heading_like = len(words) <= 6 and uppercase_ratio >= 0.75
    if heading_like and "experience" in words:
        return "experience"
    if heading_like and any(word in words for word in ("education", "skills", "projects")):
        return next(word for word in ("education", "skills", "projects") if word in words)
    if heading_like and any(word.startswith("certif") for word in words):
        return "certifications"
    return None


def _sections(lines: list[str]) -> dict[str, list[str]]:
    section_names = ("education", "experience", "skills", "certifications", "projects")
    sections = {name: [] for name in section_names}
    active: str | None = None
    for line in lines:
        heading = _heading_for(line.rstrip(":"))
        if heading is not None:
            active = heading if heading in sections else None
            continue
        if active and len(sections[active]) < 60:
            sections[active].append(line[:300])
    return sections


def _name(lines: list[str]) -> str | None:
    """Find a likely person name in the résumé header before the first section."""
    for line in lines[:10]:
        if _heading_for(line.rstrip(":")) is not None:
            break
        candidate = line.strip(" |,")
        if any(marker in candidate for marker in ("@", "http://", "https://")):
            continue
        if re.search(r"\d", candidate):
            continue
        words = candidate.split()
        if 2 <= len(words) <= 4 and all(
            re.fullmatch(r"[A-Za-z][A-Za-z'.-]*", word) for word in words
        ):
            return " ".join(word.capitalize() for word in words)
    return None


def _certifications(text: str) -> list[str]:
    found: list[str] = []
    for pattern, canonical in CERTIFICATION_PATTERNS:
        match = re.search(pattern, text, re.I)
        if match:
            value = canonical or match.group(0).strip(" ,;•")
            if value not in found:
                found.append(value)
    return found


def _skills(text: str, skill_lines: list[str]) -> list[str]:
    """Collect each explicit skill while preserving useful multi-word labels."""
    found: list[str] = []
    seen: set[str] = set()

    for line in skill_lines:
        value = re.sub(r"^[•*\-\s]+", "", line).strip()
        if ":" in value:
            category, remainder = value.split(":", 1)
            if len(category.split()) <= 5:
                value = remainder.strip()

        # Split list punctuation, but keep commas inside labels such as
        # "Python (pandas, scikit-learn)" intact.
        for item in re.split(r"[;|]|,(?![^()]*\))", value):
            skill = item.strip(" .•*-")
            tool_with_details = re.fullmatch(r"(Excel|Python)\s*\([^)]*\)", skill, re.I)
            if tool_with_details:
                skill = tool_with_details.group(1).title()
            key = skill.casefold()
            if skill and len(skill) <= 80 and key not in seen:
                found.append(skill)
                seen.add(key)

    # Retain familiar tools mentioned elsewhere when the document does not
    # repeat them in its dedicated skills section.
    for term in sorted(SKILL_TERMS):
        key = term.casefold()
        already_represented = any(
            re.search(rf"\b{re.escape(term)}\b", skill, re.I) for skill in found
        )
        if (
            key not in seen
            and not already_represented
            and re.search(rf"\b{re.escape(term)}\b", text, re.I)
        ):
            found.append(term)
            seen.add(key)
    return found


def _rank_skills(skills: list[str], education_lines: list[str]) -> list[str]:
    """Return the ten skills most relevant to the candidate's education."""
    education = " ".join(education_lines).casefold()
    priorities: list[str] = []

    if any(term in education for term in ("analytics", "data science", "statistics")):
        priorities.extend(
            [
                "python", "sql", "excel", "data analysis", "data analytics",
                "machine learning", "nlp", "data quality", "data validation",
                "visualization", "tableau", "power bi", "predictive", "modeling",
                "automation", "rest api", "javascript", "root-cause",
            ]
        )
    if any(term in education for term in ("healthcare", "health care", "clinical")):
        priorities.extend(
            [
                "healthcare informatics", "clinical", "healthcare", "hipaa",
                "nlp", "data quality",
            ]
        )
    if any(term in education for term in ("business", "marketing", "management")):
        priorities.extend(
            [
                "business", "marketing", "stakeholder", "communication",
                "process", "project management", "operational",
            ]
        )

    if not priorities:
        return skills[:10]

    def relevance(skill: str) -> int:
        normalized = skill.casefold()
        return max(
            (
                max(30 - index, 1)
                for index, keyword in enumerate(priorities)
                if keyword in normalized
            ),
            default=0,
        )

    ranked = sorted(enumerate(skills), key=lambda pair: (-relevance(pair[1]), pair[0]))
    return [skill for _, skill in ranked[:10]]


def build_fallback_draft(text: str) -> ResumeDraft:
    """Create a useful local draft without sending résumé text to a model."""
    lines = _lines(text)
    sections = _sections(lines)
    return ResumeDraft(
        name=_name(lines),
        education=sections["education"],
        experience=sections["experience"],
        skills=_rank_skills(_skills(text, sections["skills"]), sections["education"]),
        certifications=_certifications(text),
        projects=sections["projects"],
    )
