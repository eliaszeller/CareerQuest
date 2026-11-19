"""Recall@k for occupation retrieval: TF-IDF baseline versus a sentence embedder.

The same eval.jsonl and corpus.jsonl are used for every model, so numbers are
comparable before and after fine-tuning.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

KS = (1, 5, 10)


def load_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def retrieval_metrics(scores: np.ndarray, gold: list[int]) -> dict[str, float]:
    """scores: queries x documents. gold: index of the right document for each query."""
    order = np.argsort(-scores, axis=1)
    ranks = np.array([int(np.where(order[i] == g)[0][0]) + 1 for i, g in enumerate(gold)])
    metrics = {f"recall@{k}": round(float(np.mean(ranks <= k)), 4) for k in KS}
    metrics["mrr@10"] = round(float(np.mean(np.where(ranks <= 10, 1.0 / ranks, 0.0))), 4)
    metrics["queries"] = len(gold)
    return metrics


def tfidf_scores(queries: list[str], documents: list[str]) -> np.ndarray:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import linear_kernel

    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
    matrix = vectorizer.fit_transform(documents)
    return linear_kernel(vectorizer.transform(queries), matrix)


def embedding_scores(model_name: str, queries: list[str], documents: list[str]) -> np.ndarray:
    from sentence_transformers import SentenceTransformer  # optional dependency

    model = SentenceTransformer(model_name)
    q = model.encode(queries, batch_size=64, normalize_embeddings=True, show_progress_bar=True)
    d = model.encode(documents, batch_size=64, normalize_embeddings=True, show_progress_bar=True)
    return q @ d.T


def evaluate(data_dir: Path, model: str | None = None) -> dict[str, float]:
    corpus = load_jsonl(data_dir / "corpus.jsonl")
    rows = load_jsonl(data_dir / "eval.jsonl")
    index = {doc["soc"]: i for i, doc in enumerate(corpus)}
    rows = [row for row in rows if row["soc"] in index]
    queries = [row["query"] for row in rows]
    documents = [doc["text"] for doc in corpus]
    gold = [index[row["soc"]] for row in rows]
    scores = embedding_scores(model, queries, documents) if model else \
        tfidf_scores(queries, documents)
    return {"model": model or "tfidf", **retrieval_metrics(np.asarray(scores), gold)}
