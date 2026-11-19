"""Combine the resume classifier and O*NET matching into reviewable suggestions."""

from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings
from app.repositories.careers import CareerDataUnavailable, CareerRepository
from app.resume.categories import display_label, mapped_socs
from app.resume.classifier import predict_categories
from app.schemas.career import (
    CareerSuggestions,
    CategoryGuess,
    OccupationSuggestion,
)
from app.services.occupation_match import match_occupations

NOTE = (
    "Suggestions come from comparing your resume's wording with labelled resumes and "
    "O*NET occupation profiles. They are starting points to explore, not a judgment of "
    "your fit or ability."
)


def suggest_careers(text: str) -> CareerSuggestions | None:
    settings = get_settings()
    db_path = Path(settings.career_db_path)
    try:
        repo = CareerRepository(db_path)
    except CareerDataUnavailable:
        repo = None

    categories = None
    predicted = predict_categories(text)
    if predicted:
        ranked, version = predicted
        categories = [
            CategoryGuess(category=label, label=display_label(label),
                          confidence=round(p, 3), model_version=version)
            for label, p in ranked
        ]

    occupations: list[OccupationSuggestion] = []
    seen: set[str] = set()
    if repo is not None:
        for soc, title, score in match_occupations(
                text, db_path, embedder_path=Path(settings.embedder_model_path)):
            occupations.append(OccupationSuggestion(soc=soc, title=title, score=score,
                                                    reason="similar_wording"))
            seen.add(soc)
        if categories:
            for soc in mapped_socs(categories[0].category):
                if soc not in seen:
                    detail = repo.occupation_title(soc)
                    if detail:
                        occupations.append(OccupationSuggestion(
                            soc=soc, title=detail, score=None, reason="resume_category"))
                        seen.add(soc)

    if not categories and not occupations:
        return None
    return CareerSuggestions(
        categories=categories or [],
        occupations=occupations,
        note=NOTE,
        source=repo.source() if repo is not None else None,
    )
