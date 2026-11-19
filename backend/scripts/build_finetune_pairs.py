"""Write fine-tuning data for the career embedder to data/processed/finetune/.

Needs careers.db with postings (build_career_db.py, then build_posting_index.py).
Upload the four .jsonl files to the notebook in notebooks/finetune_embedder.ipynb.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.careers.postings import PostingsSourceError  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.finetune.pairs import build_pairs  # noqa: E402

DATA = Path(__file__).resolve().parents[2] / "data"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=Path(get_settings().career_db_path))
    parser.add_argument("--source", type=Path, default=DATA / "raw" / "linkedin")
    parser.add_argument("--out", type=Path, default=DATA / "processed" / "finetune")
    parser.add_argument("--per-soc-cap", type=int, default=40,
                        help="most training postings per occupation, so nurses don't dominate")
    args = parser.parse_args()
    try:
        counts = build_pairs(args.db, args.source, args.out, per_soc_cap=args.per_soc_cap)
    except (PostingsSourceError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
    for key, value in counts.items():
        print(f"  {key}: {value:,}")
    print(f"Wrote {args.out}")
