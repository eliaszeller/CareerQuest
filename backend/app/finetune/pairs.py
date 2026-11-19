"""Build training and evaluation data for fine-tuning a career retrieval embedder.

The task: given a job posting (or a resume-like text), retrieve the right O*NET
occupation. Each occupation becomes one short document (see `occupation_document`).

Positive pairs come from two places:
  * O*NET alternate titles ("RN Case Manager" -> Registered Nurses), and
  * LinkedIn postings whose title mapped to an occupation exactly or by phrase
    (match score >= 0.95), so fuzzy mapping noise stays out of the labels.

Postings are split by job id before anything is written, so no evaluation posting
or its exact text appears in training. Evaluation reports Recall@k over all
occupations. The output is derived from CC BY-SA postings and must stay under that
license; it must not leave the class project.
"""

from __future__ import annotations

import json
import random
import sqlite3
from collections import defaultdict
from contextlib import closing
from pathlib import Path

from app.careers.postings import read_postings
from app.services.skills import FastMatcher, build_terms

QUERY_CHARS = 700


def occupation_documents(db: sqlite3.Connection) -> dict[str, tuple[str, str]]:
    """soc -> (title, short document) used as the retrieval target for every model."""
    occupations = db.execute("SELECT soc, title, description FROM occupations").fetchall()
    titles: dict[str, list[str]] = defaultdict(list)
    for soc, title in db.execute("SELECT soc, title FROM job_titles ORDER BY rowid"):
        titles[soc].append(title)
    skills: dict[str, list[str]] = defaultdict(list)
    for soc, name in db.execute(
        "SELECT soc, name FROM skill_ratings WHERE kind = 'essential' AND importance >= 3 "
        "ORDER BY importance DESC"
    ):
        skills[soc].append(name)
    tools: dict[str, list[str]] = defaultdict(list)
    for soc, name in db.execute("SELECT soc, name FROM software ORDER BY hot DESC, in_demand DESC"):
        tools[soc].append(name)
    docs = {}
    for soc, title, description in occupations:
        alternates = [t for t in titles[soc] if t != title][:6]
        parts = [f"{title}.", description or ""]
        if alternates:
            parts.append("Also called: " + ", ".join(alternates) + ".")
        if skills[soc]:
            parts.append("Key skills: " + ", ".join(skills[soc][:8]) + ".")
        if tools[soc]:
            parts.append("Tools: " + ", ".join(tools[soc][:8]) + ".")
        docs[soc] = (title, " ".join(p for p in parts if p))
    return docs


def posting_query(title: str, description: str) -> str:
    text = " ".join(description.split())
    if len(text) > QUERY_CHARS:
        text = text[:QUERY_CHARS].rsplit(" ", 1)[0]
    return f"{title}. {text}".strip()


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def build_pairs(
    db_path: Path,
    postings_source: Path,
    out_dir: Path,
    eval_share: float = 0.15,
    per_soc_cap: int = 40,
    titles_per_soc: int = 15,
    max_eval: int = 2000,
    skill_examples: int = 4000,
    min_score: float = 0.95,
    seed: int = 13,
) -> dict[str, int]:
    """Write corpus.jsonl, train.jsonl, eval.jsonl and skills.jsonl into out_dir."""
    rng = random.Random(seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(f"{db_path.resolve().as_uri()}?mode=ro", uri=True)) as db:
        docs = occupation_documents(db)
        if not db.execute("SELECT name FROM sqlite_master WHERE name = 'postings'").fetchone():
            raise ValueError("Build the postings first with scripts/build_posting_index.py.")
        labels = {job_id: soc for job_id, soc in db.execute(
            "SELECT job_id, soc FROM postings WHERE match_score >= ?", (min_score,))}
        alternates = db.execute("SELECT soc, title FROM job_titles").fetchall()
        software = [r[0] for r in db.execute("SELECT DISTINCT name FROM software")]

    corpus = [{"soc": soc, "title": title, "text": text} for soc, (title, text) in
              sorted(docs.items())]

    by_soc: dict[str, list[dict]] = defaultdict(list)
    for row in read_postings(postings_source):
        soc = labels.get(row["job_id"])
        if soc in docs and row.get("description"):
            by_soc[soc].append({"job_id": row["job_id"], "soc": soc,
                                "query": posting_query(row["title"], row["description"]),
                                "description": row["description"]})

    train: list[dict] = []
    evaluation: list[dict] = []
    for soc in sorted(by_soc):
        rows = by_soc[soc]
        rng.shuffle(rows)
        held = max(1, round(len(rows) * eval_share)) if len(rows) >= 3 else 0
        evaluation.extend(rows[:held])
        train.extend(rows[held:held + per_soc_cap])
    rng.shuffle(evaluation)
    evaluation = evaluation[:max_eval]

    title_pairs: dict[str, list[str]] = defaultdict(list)
    for soc, title in alternates:
        if soc in docs and title != docs[soc][0]:
            title_pairs[soc].append(title)
    train_rows = [{"query": r["query"], "soc": r["soc"], "positive": docs[r["soc"]][1],
                   "source": "posting"} for r in train]
    for soc, names in sorted(title_pairs.items()):
        rng.shuffle(names)
        train_rows += [{"query": name, "soc": soc, "positive": docs[soc][1],
                        "source": "alternate_title"} for name in names[:titles_per_soc]]
    rng.shuffle(train_rows)

    # Weak labels for the LoRA skill extractor: O*NET software names found in the text.
    matcher = FastMatcher(build_terms(software))
    skills_rows = []
    for row in train[:skill_examples]:
        text = row["description"][:1500]
        found = sorted(matcher.find(text))
        if found:
            skills_rows.append({"text": text, "skills": found})

    _write_jsonl(out_dir / "corpus.jsonl", corpus)
    _write_jsonl(out_dir / "train.jsonl", train_rows)
    _write_jsonl(out_dir / "eval.jsonl",
                 [{"query": r["query"], "soc": r["soc"], "job_id": r["job_id"]}
                  for r in evaluation])
    _write_jsonl(out_dir / "skills.jsonl", skills_rows)
    return {"corpus": len(corpus), "train": len(train_rows),
            "train_postings": len(train), "eval": len(evaluation), "skills": len(skills_rows)}
