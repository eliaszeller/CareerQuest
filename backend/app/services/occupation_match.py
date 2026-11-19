"""Rank O*NET occupations against resume text with TF-IDF cosine similarity.

This is the matching step from "Text-based Resume Filtering Tool" (Thangaraj, Zafar and
Riyahivafa, Kaggle, Apache 2.0), applied to O*NET occupation profiles instead of a
sample of job postings. The resume text is used in memory only.
"""

from __future__ import annotations

import sqlite3
from contextlib import suppress
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.resume.training import clean_text


def _documents(path: str) -> tuple[list[str], list[str], list[str]]:
    db = sqlite3.connect(f"{Path(path).resolve().as_uri()}?mode=ro", uri=True)
    try:
        occupations = db.execute("SELECT soc, title, description FROM occupations").fetchall()
        extra: dict[str, list[str]] = {soc: [] for soc, *_ in occupations}
        for soc, title in db.execute("SELECT soc, title FROM job_titles"):
            extra[soc].append(title)
        for soc, name in db.execute(
            "SELECT soc, name FROM skill_ratings WHERE kind != 'knowledge' AND importance >= 3"
        ):
            extra[soc].append(name)
        for soc, name in db.execute("SELECT soc, name FROM software"):
            extra[soc].append(name)
    finally:
        db.close()
    socs = [soc for soc, *_ in occupations]
    titles = [title for _, title, _ in occupations]
    # Titles are repeated so they weigh more than long descriptions.
    docs = [
        clean_text(" ".join([title] * 3 + [description] + extra[soc]))
        for soc, title, description in occupations
    ]
    return socs, titles, docs


@lru_cache(maxsize=2)
def _index(path: str, mtime: float):
    from sklearn.feature_extraction.text import TfidfVectorizer

    socs, titles, docs = _documents(path)
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english",
                                 min_df=1, max_features=50000)
    matrix = vectorizer.fit_transform(docs)
    return socs, titles, vectorizer, matrix


@lru_cache(maxsize=1)
def _embedder(model_path: str, db_path: str, mtime: float):
    from sentence_transformers import SentenceTransformer  # optional; see notebooks/

    from app.finetune.pairs import occupation_documents

    db = sqlite3.connect(f"{Path(db_path).resolve().as_uri()}?mode=ro", uri=True)
    try:
        docs = occupation_documents(db)
    finally:
        db.close()
    socs = sorted(docs)
    model = SentenceTransformer(model_path)
    # Encoding ~1,000 occupations takes about a minute on a laptop CPU, so the vectors are
    # cached beside the model and rebuilt only when careers.db changes.
    cache = Path(model_path) / "occupation_vectors.npz"
    try:
        saved = np.load(cache, allow_pickle=False)
        if float(saved["db_mtime"]) == mtime and list(saved["socs"]) == socs:
            return model, socs, [docs[soc][0] for soc in socs], saved["matrix"]
    except (OSError, KeyError, ValueError):
        pass
    matrix = model.encode([docs[soc][1] for soc in socs], batch_size=64,
                          normalize_embeddings=True)
    with suppress(OSError):
        np.savez(cache, matrix=matrix, socs=np.array(socs), db_mtime=np.float64(mtime))
    return model, socs, [docs[soc][0] for soc in socs], matrix


def _embedding_match(text: str, db_path: Path, model_path: Path, top: int
                     ) -> list[tuple[str, str, float]] | None:
    try:
        model, socs, titles, matrix = _embedder(str(model_path), str(db_path),
                                                db_path.stat().st_mtime)
    except (ImportError, OSError, sqlite3.Error, ValueError):
        return None
    query = model.encode([" ".join(text.split())[:2000]], normalize_embeddings=True)[0]
    scores = matrix @ query
    best = scores.argsort()[::-1][:top]
    return [(socs[i], titles[i], round(float(scores[i]), 4)) for i in best]


def match_occupations(text: str, db_path: Path, top: int = 5,
                      embedder_path: Path | None = None) -> list[tuple[str, str, float]]:
    """(soc, title, cosine score) for the closest occupations; empty when unavailable.

    Uses the fine-tuned embedder when it has been trained and sentence-transformers is
    installed, and TF-IDF otherwise.
    """
    if embedder_path is not None and embedder_path.is_dir():
        matches = _embedding_match(text, db_path, embedder_path, top)
        if matches is not None:
            return matches
    try:
        socs, titles, vectorizer, matrix = _index(str(db_path), db_path.stat().st_mtime)
    except (FileNotFoundError, ImportError, sqlite3.Error):
        return []
    from sklearn.metrics.pairwise import linear_kernel

    query = vectorizer.transform([clean_text(text)])
    scores = linear_kernel(query, matrix)[0]
    best = scores.argsort()[::-1][:top]
    return [(socs[i], titles[i], round(float(scores[i]), 4)) for i in best if scores[i] > 0]
