"""Build the read-only CareerQuest career database from O*NET 31.0 CSV files.

The source may be the downloaded ``db_31_0_csv.zip`` or a folder of its CSV files.
Run ``python scripts/build_career_db.py`` from ``backend``; the API only reads the result.
"""

from __future__ import annotations

import csv
import io
import os
import sqlite3
import tempfile
import zipfile
from collections.abc import Callable, Iterator
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

ONET_VERSION = "31.0"
SOURCE_NAME = f"O*NET {ONET_VERSION} Database"
LICENSE_NAME = "CC BY 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
ATTRIBUTION = (
    f"This page includes information from the O*NET {ONET_VERSION} Database by the U.S. "
    "Department of Labor, Employment and Training Administration (USDOL/ETA). Used under "
    "the CC BY 4.0 license. O*NET® is a trademark of USDOL/ETA. CareerQuest has modified "
    "all or some of this information. USDOL/ETA has not approved, endorsed, or tested "
    "these modifications."
)

SKILL_FILES = {
    "essential": "essential_skills.csv",
    "transferable": "transferable_skills.csv",
    "knowledge": "knowledge.csv",
}
REQUIRED_FILES = {
    "occupation_data.csv",
    "job_titles.csv",
    "software_skills.csv",
    "job_zones.csv",
    "related_occupations.csv",
    *SKILL_FILES.values(),
}
OPTIONAL_FILES = {"job_zone_reference.csv"}

SOC = "O*NET-SOC Code"
REQUIRED_COLUMNS = {
    "occupation_data.csv": {SOC, "Title", "Description"},
    "job_titles.csv": {SOC, "Job Title"},
    "software_skills.csv": {SOC, "Workplace Example", "Element Name", "Hot Technology",
                            "In Demand"},
    "job_zones.csv": {SOC, "Job Zone"},
    "related_occupations.csv": {SOC, "Related O*NET-SOC Code", "Relatedness Tier", "Index"},
    "job_zone_reference.csv": {"Job Zone", "Name", "Experience", "Education", "Job Training"},
    **{
        name: {SOC, "Element ID", "Element Name", "Scale ID", "Data Value"}
        for name in SKILL_FILES.values()
    },
}

SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE occupations (
    soc TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    job_zone INTEGER
);
CREATE TABLE job_titles (
    soc TEXT NOT NULL REFERENCES occupations(soc),
    title TEXT NOT NULL,
    title_lc TEXT NOT NULL
);
CREATE TABLE skill_ratings (
    soc TEXT NOT NULL REFERENCES occupations(soc),
    kind TEXT NOT NULL CHECK (kind IN ('essential', 'transferable', 'knowledge')),
    element_id TEXT NOT NULL,
    name TEXT NOT NULL,
    importance REAL,
    level REAL,
    PRIMARY KEY (soc, kind, element_id)
);
CREATE TABLE software (
    soc TEXT NOT NULL REFERENCES occupations(soc),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    hot INTEGER NOT NULL,
    in_demand INTEGER NOT NULL
);
CREATE TABLE related (
    soc TEXT NOT NULL REFERENCES occupations(soc),
    related_soc TEXT NOT NULL,
    tier TEXT NOT NULL,
    rank INTEGER NOT NULL
);
CREATE TABLE job_zone_reference (
    zone INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    experience TEXT NOT NULL,
    education TEXT NOT NULL,
    training TEXT NOT NULL
);
CREATE INDEX job_titles_lc ON job_titles(title_lc);
CREATE INDEX job_titles_soc ON job_titles(soc);
CREATE INDEX software_soc ON software(soc);
CREATE INDEX software_name ON software(name);
CREATE INDEX related_soc ON related(soc);
"""


class OnetSourceError(ValueError):
    """The O*NET download is missing files or columns this build needs."""


Opener = Callable[[], io.TextIOBase]


def _index_source(source: Path) -> dict[str, Opener]:
    """Map lowercase CSV basenames to openers, for a zip or a (nested) folder."""
    openers: dict[str, Opener] = {}
    if source.is_file() and zipfile.is_zipfile(source):
        archive = zipfile.ZipFile(source)
        for member in archive.namelist():
            name = Path(member).name.lower()
            if name.endswith(".csv"):
                openers[name] = lambda member=member: io.TextIOWrapper(
                    archive.open(member), encoding="utf-8-sig", newline=""
                )
    elif source.is_dir():
        for path in source.rglob("*.csv"):
            openers[path.name.lower()] = lambda path=path: path.open(
                encoding="utf-8-sig", newline=""
            )
    else:
        raise OnetSourceError(f"{source} is not an O*NET CSV zip or folder.")

    missing = sorted(REQUIRED_FILES - set(openers))
    if missing:
        raise OnetSourceError(
            "The O*NET download is missing: " + ", ".join(missing)
            + f". Use the O*NET {ONET_VERSION} CSV files."
        )
    return openers


def _rows(openers: dict[str, Opener], name: str) -> Iterator[dict[str, str]]:
    with openers[name]() as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED_COLUMNS[name] - set(reader.fieldnames or [])
        if missing:
            raise OnetSourceError(f"{name} is missing columns: {', '.join(sorted(missing))}")
        for row in reader:
            yield {key: (value or "").strip() for key, value in row.items() if key}


def _number(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def build_career_db(source: Path, target: Path) -> dict[str, int]:
    """Build ``target`` atomically from ``source``. Returns row counts per table."""
    openers = _index_source(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(suffix=".db", dir=target.parent)
    os.close(handle)
    temp = Path(temp_name)
    try:
        # Close the connection before replacing: Windows cannot move an open file.
        with closing(sqlite3.connect(temp)) as db:
            db.executescript(SCHEMA)
            counts = _load(db, openers)
            db.commit()
        os.replace(temp, target)
        return counts
    finally:
        temp.unlink(missing_ok=True)


def _load(db: sqlite3.Connection, openers: dict[str, Opener]) -> dict[str, int]:
    zones = {
        row[SOC]: int(row["Job Zone"])
        for row in _rows(openers, "job_zones.csv")
        if row["Job Zone"].isdigit()
    }
    occupations = []
    for row in _rows(openers, "occupation_data.csv"):
        occupations.append((row[SOC], row["Title"], row["Description"], zones.get(row[SOC])))
    db.executemany("INSERT INTO occupations VALUES (?, ?, ?, ?)", occupations)
    known = {soc for soc, *_ in occupations}

    titles = {(soc, title) for soc, title, *_ in occupations}
    for row in _rows(openers, "job_titles.csv"):
        if row[SOC] in known and row["Job Title"]:
            titles.add((row[SOC], row["Job Title"]))
    db.executemany(
        "INSERT INTO job_titles VALUES (?, ?, ?)",
        sorted((soc, title, title.casefold()) for soc, title in titles),
    )

    ratings: dict[tuple[str, str, str], dict[str, object]] = {}
    for kind, name in SKILL_FILES.items():
        for row in _rows(openers, name):
            if row[SOC] not in known:
                continue
            if row.get("Not Relevant") == "Y" or row.get("Recommend Suppress") == "Y":
                continue
            key = (row[SOC], kind, row["Element ID"])
            rating = ratings.setdefault(key, {"name": row["Element Name"]})
            # IM = Importance (1-5), LV = Level (0-7) on the O*NET scales.
            if row["Scale ID"] == "IM":
                rating["importance"] = _number(row["Data Value"])
            elif row["Scale ID"] == "LV":
                rating["level"] = _number(row["Data Value"])
    db.executemany(
        "INSERT INTO skill_ratings VALUES (?, ?, ?, ?, ?, ?)",
        [
            (soc, kind, element, value["name"], value.get("importance"), value.get("level"))
            for (soc, kind, element), value in sorted(ratings.items())
        ],
    )

    software = [
        (
            row[SOC],
            row["Workplace Example"],
            row["Element Name"],
            int(row["Hot Technology"] == "Y"),
            int(row["In Demand"] == "Y"),
        )
        for row in _rows(openers, "software_skills.csv")
        if row[SOC] in known and row["Workplace Example"]
    ]
    db.executemany("INSERT INTO software VALUES (?, ?, ?, ?, ?)", software)

    related = [
        (row[SOC], row["Related O*NET-SOC Code"], row["Relatedness Tier"],
         int(row["Index"]) if row["Index"].isdigit() else 999)
        for row in _rows(openers, "related_occupations.csv")
        if row[SOC] in known and row["Related O*NET-SOC Code"] in known
    ]
    db.executemany("INSERT INTO related VALUES (?, ?, ?, ?)", related)

    reference = []
    if "job_zone_reference.csv" in openers:
        reference = [
            (int(row["Job Zone"]), row["Name"], row["Experience"], row["Education"],
             row["Job Training"])
            for row in _rows(openers, "job_zone_reference.csv")
            if row["Job Zone"].isdigit()
        ]
        db.executemany("INSERT INTO job_zone_reference VALUES (?, ?, ?, ?, ?)", reference)

    meta = {
        "source_name": SOURCE_NAME,
        "onet_version": ONET_VERSION,
        "license": LICENSE_NAME,
        "license_url": LICENSE_URL,
        "attribution": ATTRIBUTION,
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    db.executemany("INSERT INTO meta VALUES (?, ?)", sorted(meta.items()))
    return {
        "occupations": len(occupations),
        "job_titles": len(titles),
        "skill_ratings": len(ratings),
        "software": len(software),
        "related": len(related),
        "job_zone_reference": len(reference),
    }
