"""Add LinkedIn job postings to careers.db and build the posting search index.

Needs careers.db (build_career_db.py) and the career extra: pip install -e ".[career]".
Source: the Kaggle download zip, its unzipped folder, or postings.csv itself.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.careers.postings import PostingsSourceError, build_postings  # noqa: E402
from app.core.config import get_settings  # noqa: E402

DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "data" / "raw" / "linkedin"

if __name__ == "__main__":
    settings = get_settings()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--db", type=Path, default=Path(settings.career_db_path))
    parser.add_argument("--index", type=Path, default=Path(settings.postings_index_path))
    parser.add_argument("--no-index", action="store_true", help="skip the search index")
    parser.add_argument("--threshold", type=float, default=0.6,
                        help="minimum fuzzy title similarity to map a posting (0-1)")
    parser.add_argument("--max-index", type=int, default=60_000,
                        help="newest postings to include in the search index")
    args = parser.parse_args()
    print("Reading postings...", flush=True)
    try:
        counts = build_postings(args.source, args.db, None if args.no_index else args.index,
                                args.threshold, args.max_index,
                                progress=lambda message: print(message, flush=True))
    except PostingsSourceError as exc:
        raise SystemExit(str(exc)) from exc
    for key, value in counts.items():
        print(f"  {key}: {value:,}")
    mapped = counts["postings_mapped"] / max(counts["postings_read"], 1)
    print(f"Mapped {mapped:.0%} of postings to O*NET occupations.")
    print(f"Check the most common unmapped and fuzzy titles in "
          f"{args.db.parent / 'postings_mapping_report.csv'}")
