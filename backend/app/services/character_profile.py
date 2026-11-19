"""Conservative, deterministic extraction. No model calls or inferred proficiency."""

from __future__ import annotations

import re

from app.schemas.character import CharacterEntry, CharacterProfile
from app.services.resume_profile import _heading_for, _lines, _name, _skills

EXTRA_HEADINGS = {
    "interests": "interests",
    "personal interests": "interests",
    "hobbies": "hobbies",
    "hobbies and interests": "hobbies",
    "coursework": "classes",
    "relevant coursework": "classes",
    "courses": "classes",
    "classes": "classes",
    "activities": "experience",
    "extracurricular activities": "experience",
    "volunteering": "experience",
    "volunteer work": "experience",
    "leadership experience": "experience",
}
CATEGORIES = (
    "education",
    "experience",
    "skills",
    "interests",
    "classes",
    "hobbies",
    "projects",
    "certifications",
)


def build_character_draft(text: str) -> tuple[CharacterProfile, list[str]]:
    sections: dict[str, list[str]] = {key: [] for key in CATEGORIES}
    active = None
    unclassified = False
    lines = _lines(text)
    for line in lines:
        if re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]+|https?://|www\.", line):
            unclassified = True
            continue
        if re.fullmatch(r"[+()\d\s.-]{7,}", line) and len(re.sub(r"\D", "", line)) >= 10:
            unclassified = True
            continue
        prefix, separator, remainder = line.partition(":")
        inline_heading = EXTRA_HEADINGS.get(prefix.casefold()) or _heading_for(prefix)
        if separator and remainder.strip() and inline_heading in sections:
            sections[inline_heading].append(remainder.strip())
            continue
        normalized = line.rstrip(":").casefold().replace("&", "and")
        heading = EXTRA_HEADINGS.get(normalized) or _heading_for(line.rstrip(":"))
        if heading:
            active = heading if heading in sections else None
            continue
        # Inline coursework is common inside education sections.
        inline = re.match(r"^(?:relevant )?(?:coursework|courses|classes):\s*(.+)", line, re.I)
        if inline:
            sections["classes"].append(inline.group(1))
        elif active:
            sections[active].append(line)
        else:
            unclassified = True

    entries: list[CharacterEntry] = []
    for category, values in sections.items():
        if category == "skills":
            # Keep every explicit skill, not a degree-biased top-ten shortlist.
            values = _skills("", values)
        elif category in ("interests", "classes", "hobbies", "certifications"):
            values = [
                item.strip(" •*-")
                for line in values
                for item in re.split(r"[;|]|,(?![^()]*\))", line)
            ]
        else:
            # Preserve order and context instead of guessing employer/role relationships.
            # Bound each editable block without silently dropping long sections.
            blocks: list[str] = []
            block = ""
            for line in values:
                for offset in range(0, len(line), 1500):
                    part = line[offset : offset + 1500]
                    if len(block) + len(part) + 1 > 1900:
                        blocks.append(block)
                        block = ""
                    block += ("\n" if block else "") + part
            if block:
                blocks.append(block)
            values = blocks
        seen: set[str] = set()
        for value in (
            part
            for original in values
            for part in [original[i : i + 1900] for i in range(0, len(original), 1900)]
        ):
            value = value.strip()
            if not value or (
                category not in ("education", "experience", "projects") and value.casefold() in seen
            ):
                continue
            seen.add(value.casefold())
            first, _, rest = value.partition("\n")
            title = first[:160]
            details = rest if len(first) <= 160 else value
            entries.append(
                CharacterEntry(
                    category=category,
                    title=title,
                    details=details,
                    source="resume",
                    status="suggested",
                    evidence=value[:500],
                )
            )
    warnings = [
        "Suggestions are extracted text, not verified skills or qualifications. "
        "Check grouped sections and edit, confirm, or remove each item."
    ]
    if unclassified:
        warnings.append(
            "Contact details and unrecognized sections are not imported. "
            "Compare with your document and add anything missing."
        )
    if len(entries) > 200:
        warnings.append("Only the first 200 items were imported. Add any missing details manually.")
    if not entries:
        warnings.append(
            "No recognized sections were found. You can still build your character manually."
        )
    name = _name(lines)
    if name and name.casefold() in EXTRA_HEADINGS:
        name = None
    return CharacterProfile(name=(name or "")[:80], entries=entries[:200]), warnings
