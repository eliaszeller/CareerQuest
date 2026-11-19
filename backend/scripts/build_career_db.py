"""Build data/processed/careers.db from the O*NET 31.0 CSV zip or folder."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.careers.build import OnetSourceError, build_career_db  # noqa: E402
from app.core.config import get_settings  # noqa: E402

DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "data" / "raw" / "onet" / "db_31_0_csv.zip"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE,
                        help="O*NET CSV zip, or a folder of its CSV files")
    parser.add_argument("--target", type=Path, default=Path(get_settings().career_db_path))
    args = parser.parse_args()
    try:
        counts = build_career_db(args.source, args.target)
    except OnetSourceError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"Built {args.target}")
    for table, count in counts.items():
        print(f"  {table}: {count:,}")
