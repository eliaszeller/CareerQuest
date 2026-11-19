"""Read-only queries over the career database built by scripts/build_career_db.py."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from app.careers.families import CATEGORY_SOC_PREFIXES
from app.schemas.career import (
    REQUIRED_IMPORTANCE,
    DataSource,
    JobZone,
    MarketSummary,
    OccupationDetail,
    OccupationSummary,
    PostingSummary,
    PreferredSkill,
    RelatedOccupation,
    SalaryRange,
    SkillRating,
    SoftwareSkill,
)

POSTING_COLUMNS = (
    "job_id, soc, title, company, location, experience_level, work_type, salary_annual, "
    "listed_date, url, snippet"
)


def _posting(row: sqlite3.Row, score: float | None = None) -> PostingSummary:
    # sqlite3.Row iterates values, so .keys() is needed here.
    return PostingSummary(**{key: row[key] for key in row.keys()}, score=score)  # noqa: SIM118


class CareerDataUnavailable(RuntimeError):
    """The career database has not been built yet."""


def _like_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class CareerRepository:
    def __init__(self, path: Path) -> None:
        if not path.is_file():
            raise CareerDataUnavailable(str(path))
        self.path = path

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(f"{self.path.resolve().as_uri()}?mode=ro", uri=True)
        db.row_factory = sqlite3.Row
        try:
            yield db
        finally:
            db.close()

    def source(self) -> DataSource:
        with self._connect() as db:
            meta = dict(db.execute("SELECT key, value FROM meta").fetchall())
        return DataSource(
            name=meta["source_name"],
            version=meta["onet_version"],
            license=meta["license"],
            license_url=meta["license_url"],
            attribution=meta["attribution"],
        )

    def search(self, query: str, limit: int = 10) -> list[OccupationSummary]:
        needle = " ".join(query.casefold().split())
        if not needle:
            return []
        escaped = _like_escape(needle)
        with self._connect() as db:
            # Exact > prefix > contains; the occupation's own title beats an alternate.
            # SQLite returns the bare columns from the row holding MIN(rank).
            rows = db.execute(
                """
                SELECT o.soc, o.title, o.job_zone, t.title AS matched,
                       MIN((CASE WHEN t.title_lc = :q THEN 0
                                 WHEN t.title_lc LIKE :prefix ESCAPE '\\' THEN 2
                                 ELSE 4 END)
                           + (t.title != o.title)) AS rank
                FROM job_titles t JOIN occupations o ON o.soc = t.soc
                WHERE t.title_lc LIKE :contains ESCAPE '\\'
                GROUP BY o.soc
                ORDER BY rank, length(matched), o.title
                LIMIT :limit
                """,
                {"q": needle, "prefix": f"{escaped}%", "contains": f"%{escaped}%",
                 "limit": limit},
            ).fetchall()
        return [
            OccupationSummary(soc=r["soc"], title=r["title"], job_zone=r["job_zone"],
                              matched_title=r["matched"])
            for r in rows
        ]

    def explore(self, category: str, limit: int = 25) -> list[OccupationSummary]:
        prefixes = CATEGORY_SOC_PREFIXES[category]
        clause = " OR ".join("soc LIKE ?" for _ in prefixes)
        with self._connect() as db:
            rows = db.execute(
                f"SELECT soc, title, job_zone FROM occupations WHERE {clause} "
                "ORDER BY job_zone IS NULL, job_zone, title LIMIT ?",
                [f"{prefix}%" for prefix in prefixes] + [limit],
            ).fetchall()
        return [
            OccupationSummary(soc=r["soc"], title=r["title"], job_zone=r["job_zone"],
                              matched_title=r["title"])
            for r in rows
        ]

    def occupation(self, soc: str) -> OccupationDetail | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM occupations WHERE soc = ?", (soc,)).fetchone()
            if row is None:
                return None
            titles = [
                r[0] for r in db.execute(
                    "SELECT title FROM job_titles WHERE soc = ? AND title != ? "
                    "ORDER BY length(title), title LIMIT 15", (soc, row["title"]),
                )
            ]
            zone = None
            if row["job_zone"] is not None:
                ref = db.execute(
                    "SELECT * FROM job_zone_reference WHERE zone = ?", (row["job_zone"],)
                ).fetchone()
                zone = JobZone(
                    zone=row["job_zone"],
                    name=ref["name"] if ref else None,
                    education=ref["education"] if ref else None,
                    experience=ref["experience"] if ref else None,
                    training=ref["training"] if ref else None,
                )

            def ratings(kind: str, limit: int) -> list[SkillRating]:
                rows = db.execute(
                    "SELECT * FROM skill_ratings WHERE soc = ? AND kind = ? "
                    "ORDER BY importance IS NULL, importance DESC, name LIMIT ?",
                    (soc, kind, limit),
                ).fetchall()
                return [
                    SkillRating(
                        element_id=r["element_id"], name=r["name"],
                        importance=r["importance"], level=r["level"],
                        required=(r["importance"] or 0) >= REQUIRED_IMPORTANCE,
                    )
                    for r in rows
                ]

            software = [
                SoftwareSkill(name=r["name"], category=r["category"],
                              hot_technology=bool(r["hot"]), in_demand=bool(r["in_demand"]))
                for r in db.execute(
                    "SELECT * FROM software WHERE soc = ? "
                    "ORDER BY in_demand DESC, hot DESC, name LIMIT 25", (soc,),
                )
            ]
            related = [
                RelatedOccupation(soc=r["related_soc"], title=r["title"], tier=r["tier"])
                for r in db.execute(
                    "SELECT r.related_soc, r.tier, o.title FROM related r "
                    "JOIN occupations o ON o.soc = r.related_soc WHERE r.soc = ? "
                    "ORDER BY r.rank LIMIT 10", (soc,),
                )
            ]
            detail = OccupationDetail(
                soc=row["soc"], title=row["title"], description=row["description"],
                alternate_titles=titles, job_zone=zone,
                essential_skills=ratings("essential", 25),
                transferable_skills=ratings("transferable", 25),
                knowledge=ratings("knowledge", 10),
                software=software, related=related, source=self.source(),
                market=self._market(db, soc),
            )
        return detail

    def has_postings(self, db: sqlite3.Connection | None = None) -> bool:
        def check(conn: sqlite3.Connection) -> bool:
            return conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='postings'"
            ).fetchone() is not None
        if db is not None:
            return check(db)
        with self._connect() as conn:
            return check(conn)

    def postings_source(self) -> DataSource | None:
        with self._connect() as db:
            meta = dict(db.execute("SELECT key, value FROM meta").fetchall())
        if "postings_source" not in meta:
            return None
        return DataSource(
            name=meta["postings_source"], version=meta.get("postings_built_at", ""),
            license=meta["postings_license"], license_url=meta["postings_license_url"],
            attribution=meta["postings_attribution"],
        )

    def _market(self, db: sqlite3.Connection, soc: str) -> MarketSummary | None:
        if not self.has_postings(db):
            return None
        row = db.execute("SELECT * FROM occupation_market WHERE soc = ?", (soc,)).fetchone()
        source = self.postings_source()
        if row is None or source is None:
            return None
        salary = None
        if row["salary_median"] is not None:
            salary = SalaryRange(postings_with_salary=row["salary_n"], p25=row["salary_p25"],
                                 median=row["salary_median"], p75=row["salary_p75"])
        preferred = [
            PreferredSkill(name=r["name"], share=r["share"], in_onet=bool(r["in_onet"]))
            for r in db.execute(
                "SELECT * FROM occupation_preferred WHERE soc = ? ORDER BY share DESC, name "
                "LIMIT 12", (soc,))
        ]
        samples = [
            _posting(r) for r in db.execute(
                f"SELECT {POSTING_COLUMNS} FROM postings WHERE soc = ? "
                "ORDER BY salary_annual IS NULL, listed_date DESC, match_score DESC LIMIT 3",
                (soc,))
        ]
        return MarketSummary(postings=row["postings"], salary=salary,
                             preferred_skills=preferred, sample_postings=samples, source=source)

    def postings_by_ids(self, job_ids: list[str]) -> dict[str, PostingSummary]:
        if not job_ids:
            return {}
        with self._connect() as db:
            marks = ",".join("?" for _ in job_ids)
            rows = db.execute(
                f"SELECT {POSTING_COLUMNS} FROM postings WHERE job_id IN ({marks})", job_ids)
            return {r["job_id"]: _posting(r) for r in rows}

    def postings_by_title(self, query: str, soc: str | None, limit: int) -> list[PostingSummary]:
        if not self.has_postings():
            return []
        words = [w for w in query.casefold().split() if len(w) > 2][:6]
        clauses, params = [], []
        for word in words:
            clauses.append("lower(title) LIKE ? ESCAPE '\\'")
            params.append(f"%{_like_escape(word)}%")
        if soc:
            clauses.append("soc = ?")
            params.append(soc)
        where = " AND ".join(clauses) or "1"
        with self._connect() as db:
            rows = db.execute(
                f"SELECT {POSTING_COLUMNS} FROM postings WHERE {where} "
                "ORDER BY listed_date DESC LIMIT ?", [*params, limit])
            return [_posting(r) for r in rows]

    def occupation_title(self, soc: str) -> str | None:
        with self._connect() as db:
            row = db.execute("SELECT title FROM occupations WHERE soc = ?", (soc,)).fetchone()
        return row[0] if row else None

    def software_vocabulary(self) -> list[str]:
        """Software names worth recognizing in resumes: hot or used by 3+ occupations."""
        with self._connect() as db:
            return [
                r[0] for r in db.execute(
                    "SELECT name FROM software GROUP BY name "
                    "HAVING MAX(hot) = 1 OR COUNT(DISTINCT soc) >= 3 ORDER BY name"
                )
            ]
