"""Train the resume category classifier from the Kaggle Resume Dataset (Resume.csv).

Needs the career extra: pip install -e ".[career]". Writes backend/models/
resume_classifier.joblib and a .metrics.json report with held-out scores.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.repositories.careers import CareerDataUnavailable, CareerRepository  # noqa: E402
from app.resume.categories import CATEGORY_MAP  # noqa: E402
from app.resume.training import train  # noqa: E402

DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "data" / "raw" / "resumes" / "Resume.csv"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--target", type=Path, default=Path(get_settings().resume_model_path))
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Put Resume.csv at {args.source} (see data/README.md).")
    result = train(args.source, args.target)
    m = result.metrics
    print(f"Saved {result.model_path}")
    print(f"Resumes: {m['resumes_after_dedup']} ({m['train_size']} train / {m['test_size']} test),"
          f" {m['categories']} categories")
    print("Logistic regression:", json.dumps(m["logistic_regression"]))
    print("KNN baseline:       ", json.dumps(m["knn_baseline"]))
    print(f"Full report: {result.metrics_path}")

    unmapped = sorted(set(m["per_category"]) - set(CATEGORY_MAP)
                      - {"accuracy", "macro avg", "weighted avg"})
    if unmapped:
        print("Categories without an O*NET mapping in app/resume/categories.py:", unmapped)
    try:
        repo = CareerRepository(Path(get_settings().career_db_path))
        missing = [soc for _, socs in CATEGORY_MAP.values() for soc in socs
                   if repo.occupation_title(soc) is None]
        if missing:
            print("Mapped O*NET codes not in careers.db (they are skipped):", missing)
    except CareerDataUnavailable:
        print("careers.db not built yet, so O*NET codes were not checked.")
