"""Retrieve job postings similar to a query (skills, goal, or resume summary)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.repositories.careers import CareerRepository
from app.resume.training import clean_text
from app.schemas.career import PostingSummary


@lru_cache(maxsize=2)
def _load_index(path: str, mtime: float):
    import joblib

    # Only loads the index file written by scripts/build_posting_index.py.
    return joblib.load(path)


def search_postings(
    repo: CareerRepository, query: str, soc: str | None, limit: int
) -> tuple[list[PostingSummary], str]:
    path = Path(get_settings().postings_index_path)
    try:
        index = _load_index(str(path), path.stat().st_mtime)
    except (FileNotFoundError, ImportError):
        return repo.postings_by_title(query, soc, limit), "title_match"

    from sklearn.metrics.pairwise import linear_kernel

    scores = linear_kernel(index["vectorizer"].transform([clean_text(query)]), index["matrix"])[0]
    # Over-fetch when filtering by occupation, since the filter applies after scoring.
    ranked = scores.argsort()[::-1][: limit * (20 if soc else 1)]
    candidates = [(index["job_ids"][i], float(scores[i])) for i in ranked if scores[i] > 0]
    postings = repo.postings_by_ids([job_id for job_id, _ in candidates])
    results = []
    for job_id, score in candidates:
        posting = postings.get(job_id)
        if posting and (soc is None or posting.soc == soc):
            results.append(posting.model_copy(update={"score": round(score, 4)}))
        if len(results) == limit:
            break
    return results, "tfidf_index"
