import json
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("sklearn")

from app.careers.postings import build_postings  # noqa: E402
from app.finetune.evaluate import evaluate, retrieval_metrics  # noqa: E402
from app.finetune.pairs import build_pairs  # noqa: E402

FIXTURE = Path(__file__).parent / "fixtures" / "linkedin_mini"


def _read(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_pairs_split_postings_and_cover_corpus(career_db: Path, tmp_path: Path) -> None:
    build_postings(FIXTURE, career_db, None)
    out = tmp_path / "finetune"
    counts = build_pairs(career_db, FIXTURE, out, eval_share=0.34)
    corpus, train, held = (_read(out / f"{n}.jsonl") for n in ("corpus", "train", "eval"))
    assert counts["corpus"] == len(corpus) == 3
    assert {doc["soc"] for doc in corpus} >= {row["soc"] for row in train + held}
    assert any(row["source"] == "alternate_title" for row in train)
    held_queries = {row["query"] for row in held}
    assert held and not held_queries & {row["query"] for row in train}
    assert all("Key skills:" in doc["text"] or "Tools:" in doc["text"] for doc in corpus)
    skills = _read(out / "skills.jsonl")
    assert all(row["skills"] for row in skills)
    metrics = evaluate(out)
    assert metrics["model"] == "tfidf" and metrics["queries"] == len(held)
    assert 0 <= metrics["recall@1"] <= metrics["recall@5"] <= 1


def test_retrieval_metrics() -> None:
    scores = np.array([[0.9, 0.1, 0.0], [0.2, 0.1, 0.8], [0.5, 0.6, 0.4]])
    metrics = retrieval_metrics(scores, [0, 2, 0])
    assert metrics["recall@1"] == pytest.approx(2 / 3, abs=1e-4)
    assert metrics["recall@5"] == 1.0
    assert metrics["mrr@10"] == pytest.approx((1 + 1 + 0.5) / 3, abs=1e-4)


def test_resume_matching_falls_back_to_tfidf_without_embedder(career_db: Path, tmp_path,
                                                              monkeypatch) -> None:
    from app.services import occupation_match

    text = "Registered nurse providing patient care and medication administration"
    baseline = occupation_match.match_occupations(text, career_db)
    assert baseline[0][0] == "29-1141.00"
    # A model folder that exists but cannot be loaded (no sentence-transformers) is ignored.
    (tmp_path / "embedder").mkdir()
    monkeypatch.setattr(occupation_match, "_embedder",
                        lambda *args: (_ for _ in ()).throw(ImportError("no torch")))
    assert occupation_match.match_occupations(
        text, career_db, embedder_path=tmp_path / "embedder") == baseline
