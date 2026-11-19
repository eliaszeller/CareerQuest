"""Train the resume category classifier on the Kaggle Resume Dataset (Resume.csv).

Adapted from the approach in "Text-based Resume Filtering Tool" by Nivetha Thangaraj,
Hasan Zafar and Arian Riyahivafa (Kaggle, Apache 2.0): TF-IDF features over resume text.
Changes: a logistic-regression classifier on the dataset's own category labels (the
notebook's fit labels came from its own similarity scores), duplicates removed before a
stratified split, and a KNN baseline reported for comparison.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

MODEL_VERSION = "resume-category-1.0"


def clean_text(text: str) -> str:
    """Lowercase letters and digits only; keeps tokens such as "c++" readable as "c"."""
    return " ".join(re.sub(r"[^a-z0-9+#]+", " ", text.lower()).split())


@dataclass
class TrainingResult:
    metrics: dict
    model_path: Path
    metrics_path: Path


def load_resumes(path: Path) -> tuple[list[str], list[str]]:
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    texts: list[str] = []
    labels: list[str] = []
    seen: set[str] = set()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = {"Resume_str", "Category"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path.name} is missing columns: {', '.join(sorted(missing))}")
        for row in reader:
            text = clean_text(row["Resume_str"] or "")
            label = (row["Category"] or "").strip()
            if text and label and text not in seen:
                seen.add(text)
                texts.append(text)
                labels.append(label)
    return texts, labels


def build_pipeline():
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline

    return Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=30000, min_df=2,
                                  sublinear_tf=True, stop_words="english")),
        ("clf", LogisticRegression(max_iter=3000, class_weight="balanced", C=5.0)),
    ])


def train(source: Path, model_path: Path, test_size: float = 0.2, seed: int = 42):
    import joblib
    from sklearn.base import clone
    from sklearn.metrics import accuracy_score, classification_report, f1_score
    from sklearn.model_selection import train_test_split
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.pipeline import Pipeline

    texts, labels = load_resumes(source)
    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=test_size, random_state=seed, stratify=labels
    )
    pipeline = build_pipeline()
    pipeline.fit(x_train, y_train)
    predicted = pipeline.predict(x_test)

    knn = Pipeline([("tfidf", clone(pipeline.named_steps["tfidf"])),
                    ("clf", KNeighborsClassifier(n_neighbors=5, metric="cosine"))])
    knn.fit(x_train, y_train)
    knn_predicted = knn.predict(x_test)

    # Top-3 accuracy matters because the app shows three suggestions.
    probabilities = pipeline.predict_proba(x_test)
    classes = list(pipeline.classes_)
    top3 = sum(
        y in [classes[i] for i in row.argsort()[::-1][:3]]
        for y, row in zip(y_test, probabilities)
    ) / len(y_test)

    metrics = {
        "model_version": MODEL_VERSION,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source.name,
        "resumes_after_dedup": len(texts),
        "train_size": len(x_train),
        "test_size": len(x_test),
        "categories": len(classes),
        "logistic_regression": {
            "accuracy": round(accuracy_score(y_test, predicted), 4),
            "macro_f1": round(f1_score(y_test, predicted, average="macro"), 4),
            "top3_accuracy": round(top3, 4),
        },
        "knn_baseline": {
            "accuracy": round(accuracy_score(y_test, knn_predicted), 4),
            "macro_f1": round(f1_score(y_test, knn_predicted, average="macro"), 4),
        },
        "per_category": classification_report(
            y_test, predicted, output_dict=True, zero_division=0
        ),
    }

    # Refit on all resumes for the shipped model; the metrics above stay held-out.
    pipeline.fit(texts, labels)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "model_version": MODEL_VERSION}, model_path)
    metrics_path = model_path.with_suffix(".metrics.json")
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return TrainingResult(metrics, model_path, metrics_path)
