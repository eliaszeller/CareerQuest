"""Match free-text skills to O*NET software names.

O*NET lists software as full product names ("Microsoft Excel", "Structured query
language SQL"). Resumes usually say "Excel" or "SQL", so each name also gets safe
aliases: the product without its vendor, and a trailing acronym.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.repositories.careers import CareerDataUnavailable, CareerRepository

VENDORS = {
    "adobe", "amazon", "apple", "autodesk", "google", "ibm", "intuit", "microsoft",
    "oracle", "salesforce", "sap", "atlassian",
}
# Derived single-word aliases that are also everyday words are skipped.
AMBIGUOUS = {
    "access", "analytics", "cloud", "docs", "drive", "dynamics", "forms", "go",
    "office", "outlook", "project", "sheets", "teams", "word",
}


@dataclass(frozen=True)
class SkillTerm:
    canonical: str
    alias: str
    pattern: re.Pattern[str]
    exact: bool


def _pattern(text: str, case_sensitive: bool) -> re.Pattern[str]:
    flags = 0 if case_sensitive else re.IGNORECASE
    return re.compile(rf"(?<![\w+#]){re.escape(text)}(?![\w+#])", flags)


def build_terms(names: list[str]) -> list[SkillTerm]:
    terms: list[SkillTerm] = []
    seen: set[str] = set()

    def add(canonical: str, alias: str, exact: bool) -> None:
        key = alias.casefold()
        if not alias or (len(alias) < 2 and not exact) or key in seen:
            return
        seen.add(key)
        # Short or single-word aliases must match case exactly ("R", "Go", "Excel").
        case_sensitive = len(alias) <= 3 or (not exact and " " not in alias)
        terms.append(SkillTerm(canonical, alias, _pattern(alias, case_sensitive), exact))

    for name in names:
        add(name, name, True)
    for name in names:
        words = name.split()
        if len(words) >= 2 and words[0].casefold() in VENDORS:
            remainder = " ".join(words[1:])
            if remainder.casefold() not in AMBIGUOUS:
                add(name, remainder, False)
        if len(words) >= 2 and re.fullmatch(r"[A-Z][A-Z0-9+#.]{1,6}", words[-1]):
            add(name, words[-1], False)
    # Longer aliases first, so "Microsoft Power BI" wins over shorter overlaps.
    return sorted(terms, key=lambda term: -len(term.alias))


@lru_cache(maxsize=4)
def _terms_for(path: str, mtime: float) -> tuple[SkillTerm, ...]:
    return tuple(build_terms(CareerRepository(Path(path)).software_vocabulary()))


def known_skill_terms() -> tuple[SkillTerm, ...]:
    """O*NET software terms, or none when the career database is not built."""
    path = Path(get_settings().career_db_path)
    try:
        return _terms_for(str(path), path.stat().st_mtime)
    except (FileNotFoundError, CareerDataUnavailable):
        return ()


def find_in_text(text: str, terms: tuple[SkillTerm, ...]) -> list[str]:
    """Canonical O*NET names mentioned in ``text``, in first-mention order."""
    found: dict[str, int] = {}
    for term in terms:
        match = term.pattern.search(text)
        if match and term.canonical not in found:
            found[term.canonical] = match.start()
    return sorted(found, key=found.get)


def normalize_label(label: str, terms: tuple[SkillTerm, ...]) -> tuple[str | None, str]:
    """Map one resume skill label to an O*NET name: exact, alias, or none."""
    cleaned = label.strip()
    for term in terms:
        if term.pattern.fullmatch(cleaned):
            return term.canonical, "exact" if term.exact else "alias"
    for term in terms:
        if term.pattern.search(cleaned):
            return term.canonical, "alias"
    return None, "none"


class FastMatcher:
    """Token n-gram lookup for scanning many documents (job postings) quickly.

    Same aliases and case rules as ``build_terms``, without one regex per term.
    """

    TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9+#.]*")

    def __init__(self, terms: tuple[SkillTerm, ...] | list[SkillTerm]) -> None:
        self.lookup: dict[str, list[SkillTerm]] = {}
        self.max_words = 1
        for term in terms:
            words = self.TOKEN.findall(term.alias)
            if not words:
                continue
            self.max_words = max(self.max_words, len(words))
            self.lookup.setdefault(" ".join(words).casefold(), []).append(term)

    def find(self, text: str) -> set[str]:
        tokens = [token.rstrip(".") for token in self.TOKEN.findall(text)]
        found: set[str] = set()
        for size in range(1, self.max_words + 1):
            for start in range(len(tokens) - size + 1):
                surface = " ".join(tokens[start:start + size])
                for term in self.lookup.get(surface.casefold(), ()):
                    case_sensitive = term.pattern.flags & re.IGNORECASE == 0
                    if not case_sensitive or surface == " ".join(self.TOKEN.findall(term.alias)):
                        found.add(term.canonical)
        return found
