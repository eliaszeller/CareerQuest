"""Download the O*NET 31.0 CSV database (CC BY 4.0) into product/data/raw/onet/."""

from __future__ import annotations

import argparse
import shutil
import urllib.request
import zipfile
from pathlib import Path

URL = "https://www.onetcenter.org/dl_files/database/db_31_0_csv.zip"
TARGET = Path(__file__).resolve().parents[2] / "data" / "raw" / "onet" / "db_31_0_csv.zip"

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=URL)
    parser.add_argument("--target", type=Path, default=TARGET)
    args = parser.parse_args()
    args.target.parent.mkdir(parents=True, exist_ok=True)
    partial = args.target.with_suffix(".part")
    request = urllib.request.Request(args.url, headers={"User-Agent": "CareerQuest data build"})
    with urllib.request.urlopen(request, timeout=120) as response, partial.open("wb") as out:
        shutil.copyfileobj(response, out)
    if not zipfile.is_zipfile(partial):
        partial.unlink()
        raise SystemExit("The download was not a ZIP file. Download it manually from "
                         "https://www.onetcenter.org/database.html (CSV, All files).")
    partial.replace(args.target)
    print(f"Saved {args.target}")
