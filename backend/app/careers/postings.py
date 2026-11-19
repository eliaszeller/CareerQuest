"""Add LinkedIn job postings (Kaggle, arshkon, CC BY-SA 4.0) to careers.db.

Each posting title is mapped to an O*NET occupation: exact match on O*NET alternate
titles first, then TF-IDF similarity to each occupation's titles. Per occupation we keep
annual salary percentiles and "preferred" skills: O*NET software names that employers
mention in descriptions. A TF-IDF index over the mapped postings supports retrieval.
Output tables and the index are derived from CC BY-SA data and must be shared under
CC BY-SA 4.0 with credit to the dataset.
"""

from __future__ import annotations

import csv
import io
import re
import sqlite3
import statistics
import sys
import zipfile
from collections import Counter, defaultdict
from collections.abc import Iterator
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.resume.training import clean_text
from app.services.skills import FastMatcher, build_terms

POSTINGS_SOURCE = "LinkedIn Job Postings (2023 - 2024), Kaggle dataset by arshkon"
POSTINGS_URL = "https://www.kaggle.com/datasets/arshkon/linkedin-job-postings"
POSTINGS_LICENSE = "CC BY-SA 4.0"
POSTINGS_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"
POSTINGS_ATTRIBUTION = (
    "Job posting statistics derived from \"LinkedIn Job Postings (2023 - 2024)\" by arshkon "
    "on Kaggle, used under CC BY-SA 4.0. CareerQuest mapped titles to O*NET occupations "
    "and summarized salaries and skills; derived data is shared under the same license."
)

REQUIRED_COLUMNS = {"job_id", "title", "description"}
PAY_PERIODS = {"YEARLY": 1, "MONTHLY": 12, "BIWEEKLY": 26, "WEEKLY": 52, "HOURLY": 2080}
SENIORITY = re.compile(
    r"\b(senior|sr|junior|jr|lead|principal|staff|entry level|entry|level [0-9]+|"
    r"i{1,3}|iv|[0-9]+|remote|hybrid|onsite|on site|full time|part time|temporary|"
    r"contract|per diem|prn|travel|night shift|day shift|weekend)\b"
)

SCHEMA = """
DROP TABLE IF EXISTS postings;
DROP TABLE IF EXISTS occupation_market;
DROP TABLE IF EXISTS occupation_preferred;
CREATE TABLE postings (
    job_id TEXT PRIMARY KEY,
    soc TEXT NOT NULL REFERENCES occupations(soc),
    match_score REAL NOT NULL,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    experience_level TEXT,
    work_type TEXT,
    remote INTEGER,
    salary_annual REAL,
    listed_date TEXT,
    url TEXT,
    snippet TEXT NOT NULL
);
CREATE TABLE occupation_market (
    soc TEXT PRIMARY KEY REFERENCES occupations(soc),
    postings INTEGER NOT NULL,
    salary_n INTEGER NOT NULL,
    salary_p25 REAL,
    salary_median REAL,
    salary_p75 REAL
);
CREATE TABLE occupation_preferred (
    soc TEXT NOT NULL REFERENCES occupations(soc),
    name TEXT NOT NULL,
    postings INTEGER NOT NULL,
    share REAL NOT NULL,
    in_onet INTEGER NOT NULL,
    PRIMARY KEY (soc, name)
);
CREATE INDEX postings_soc ON postings(soc);
"""


class PostingsSourceError(ValueError):
    """The postings download is missing postings.csv or its key columns."""


ABBREVIATIONS = {
    "acct": "account", "admin": "administrative", "asst": "assistant", "assoc": "associate",
    "coord": "coordinator", "cust": "customer", "dev": "developer", "dir": "director",
    "eng": "engineer", "engr": "engineer", "exec": "executive", "mgr": "manager",
    "mgmt": "management", "ops": "operations", "rep": "representative", "spec": "specialist",
    "svc": "service", "svcs": "services", "supv": "supervisor", "tech": "technician",
    "techs": "technicians", "vp": "vice president", "avp": "assistant vice president",
    "svp": "vice president", "evp": "vice president", "hr": "human resource",
    "rn": "registered nurse", "lpn": "licensed practical nurse",
    "lvn": "licensed vocational nurse", "cna": "certified nursing assistant",
    "dotnet": "net", "it": "information technology",
}

# Words too generic to identify an occupation on their own. A fuzzy match whose O*NET
# title is only these words ("assistant", "owner", "developer") is not trusted.
GENERIC_WORDS = {
    "agent", "analyst", "assistant", "associate", "consultant", "coordinator", "developer",
    "director", "engineer", "intern", "leader", "manager", "member", "officer", "operator",
    "owner", "professional", "representative", "specialist", "supervisor", "team",
    "technician", "technologist", "worker",
}
# When nothing better matches, a title ending in one of these heads maps here
# ("python developer", "android developer" -> Software Developers).
HEAD_FALLBACK = {"developer": "15-1252.00", "programmer": "15-1251.00"}


def normalize_title(title: str) -> str:
    text = title.casefold()
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", text)
    text = re.split(r"\s[-–|/]\s|,|:", text)[0]
    text = re.sub(r"[^a-z&+# ]+", " ", text)
    text = SENIORITY.sub(" ", text)
    text = " ".join(ABBREVIATIONS.get(word, word) for word in text.split())
    # Light singularizing so "Registered Nurses" and "Registered Nurse" agree.
    words = [w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us")) else w
             for w in text.split()]
    return " ".join(words)


def annual_salary(row: dict[str, str]) -> float | None:
    if (row.get("currency") or "USD").upper() != "USD":
        return None
    try:
        normalized = float(row.get("normalized_salary") or 0)
    except ValueError:
        normalized = 0
    value = normalized
    if not value:
        period = PAY_PERIODS.get((row.get("pay_period") or "").upper())
        try:
            low, high = float(row.get("min_salary") or 0), float(row.get("max_salary") or 0)
            med = float(row.get("med_salary") or 0)
        except ValueError:
            return None
        base = med or ((low + high) / 2 if low and high else 0)
        value = base * period if period and base else 0
    return value if 10_000 <= value <= 1_000_000 else None


def _open_postings(source: Path) -> io.TextIOBase:
    if source.is_file() and zipfile.is_zipfile(source):
        archive = zipfile.ZipFile(source)
        names = [n for n in archive.namelist() if Path(n).name.lower() == "postings.csv"]
        if names:
            return io.TextIOWrapper(archive.open(names[0]), encoding="utf-8-sig", newline="")
    elif source.is_file() and source.name.lower().endswith(".csv"):
        return source.open(encoding="utf-8-sig", newline="")
    elif source.is_dir():
        matches = sorted(source.rglob("postings.csv"))
        if matches:
            return matches[0].open(encoding="utf-8-sig", newline="")
    raise PostingsSourceError(f"Could not find postings.csv in {source}.")


def read_postings(source: Path) -> Iterator[dict[str, str]]:
    csv.field_size_limit(min(sys.maxsize, 2**31 - 1))
    with _open_postings(source) as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise PostingsSourceError(
                f"postings.csv is missing columns: {', '.join(sorted(missing))}"
            )
        for row in reader:
            yield {k: (v or "").strip() for k, v in row.items() if k}


class TitleMapper:
    """Map free-text job titles to O*NET-SOC codes.

    1. Exact match on normalized O*NET titles and alternate titles.
    2. Containment: the longest O*NET title (two or more words) found as a phrase inside
       the posting title, so "registered nurse icu" maps via "registered nurse".
    3. Otherwise character n-gram TF-IDF against individual O*NET titles, which copes with
       typos and abbreviations. Only O*NET titles whose head noun (last word, such as
       "nurse" or "engineer") appears in the posting title are compared, which keeps this
       fast and stops "sales manager" becoming "sales engineer". A fuzzy match is kept
       only if it adds no qualifier the posting lacks and is not just generic words.
    4. Titles ending in "developer" or "programmer" fall back to the software occupation.
    """

    def __init__(self, db: sqlite3.Connection, threshold: float) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer

        self.threshold = threshold
        self.exact: dict[str, str] = {}
        for soc, title in db.execute("SELECT soc, title FROM job_titles ORDER BY soc"):
            key = normalize_title(title)
            if key:
                self.exact.setdefault(key, soc)
        self.keys = sorted(self.exact)
        self.socs = set(self.exact.values())
        # O*NET titles grouped by head noun: only these are candidates for a fuzzy match.
        self.by_head: dict[str, list[int]] = defaultdict(list)
        for index, key in enumerate(self.keys):
            self.by_head[key.split()[-1]].append(index)
        self.vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5),
                                          sublinear_tf=True, dtype=np.float32)

    def _contained(self, title: str) -> str | None:
        words = title.split()
        for size in range(len(words) - 1, 1, -1):
            for start in range(len(words) - size + 1):
                phrase = " ".join(words[start:start + size])
                if phrase in self.exact:
                    return phrase
        return None

    @staticmethod
    def _plausible(title: str, key: str) -> bool:
        """Reject fuzzy matches that add a qualifier the posting lacks or are too generic.

        "associate" must not become "it associate", "team member" must not become
        "sales team member", and "product owner" must not become plain "owner".
        """
        words, joined = title.split(), title.replace(" ", "")
        key_words = key.split()
        if all(word in GENERIC_WORDS for word in key_words):
            return False
        return all(
            word in joined or any(w[:5] == word[:5] for w in words if len(w) >= 4)
            for word in key_words
        )

    def _fallback(self, title: str) -> tuple[str, float, str] | None:
        soc = HEAD_FALLBACK.get(title.split()[-1])
        if soc and soc in self.socs:
            return (soc, 0.6, title.split()[-1])
        return None

    def map_many(self, titles: list[str], progress=None) -> dict[str, tuple[str, float, str]]:
        """normalized title -> (soc, score, matched O*NET title)."""
        result: dict[str, tuple[str, float, str]] = {}
        pending = []
        for title in titles:
            if title in self.exact:
                result[title] = (self.exact[title], 1.0, title)
            elif title:
                contained = self._contained(title)
                if contained:
                    result[title] = (self.exact[contained], 0.95, contained)
                else:
                    pending.append(title)
        candidates = {
            title: sorted({i for word in set(title.split()) for i in self.by_head.get(word, ())})
            for title in pending
        }
        for title in pending:
            if not candidates[title] and (fallback := self._fallback(title)):
                result[title] = fallback
        pending = [title for title in pending if candidates[title]]
        if not pending:
            return result
        # Fit on both sides so a posting's extra words count against its similarity
        # instead of being silently dropped as unknown n-grams.
        self.vectorizer.fit(self.keys + pending)
        key_matrix = self.vectorizer.transform(self.keys)
        query_matrix = self.vectorizer.transform(pending)
        for done, title in enumerate(pending, 1):
            rows = candidates[title]
            scores = (key_matrix[rows] @ query_matrix[done - 1].T).toarray().ravel()
            # Best-scoring plausible candidate above the threshold, if any.
            for best in np.argsort(-scores)[:10]:
                if scores[best] < self.threshold:
                    break
                key = self.keys[rows[best]]
                if self._plausible(title, key):
                    result[title] = (self.exact[key], round(float(scores[best]), 4), key)
                    break
            if title not in result and (fallback := self._fallback(title)):
                result[title] = fallback
            if progress and (done % 2000 == 0 or done == len(pending)):
                progress(done, len(pending))
        return result


def _percentile(values: list[float], q: float) -> float:
    return round(statistics.quantiles(values, n=100, method="inclusive")[int(q) - 1], -2)


def build_postings(
    source: Path,
    db_path: Path,
    index_path: Path | None,
    threshold: float = 0.6,
    max_index: int = 60_000,
    progress=None,
) -> dict[str, int]:
    if not db_path.is_file():
        raise PostingsSourceError(f"Build {db_path.name} with build_career_db.py first.")
    with closing(sqlite3.connect(db_path)) as db:
        mapper = TitleMapper(db, threshold)
        software = [r[0] for r in db.execute(
            "SELECT name FROM software GROUP BY name "
            "HAVING MAX(hot) = 1 OR COUNT(DISTINCT soc) >= 3")]
        onet_software = defaultdict(set)
        for soc, name in db.execute("SELECT soc, name FROM software"):
            onet_software[soc].add(name)
        matcher = FastMatcher(build_terms(software))

        rows = list(read_postings(source))
        titles = {row["job_id"]: normalize_title(row["title"]) for row in rows}
        unique_titles = sorted(set(titles.values()))
        if progress:
            progress(f"Mapping {len(unique_titles):,} unique titles from {len(rows):,} postings")
        mapping = mapper.map_many(
            unique_titles,
            (lambda done, total: progress(f"  fuzzy matching {done:,}/{total:,}")) if progress
            else None,
        )
        if progress:
            progress("Scanning descriptions for skills and salaries")
        title_counts = Counter(titles.values())
        write_mapping_report(db_path.parent / "postings_mapping_report.csv", title_counts,
                             mapping, dict(db.execute("SELECT soc, title FROM occupations")))

        records = []
        texts: dict[str, str] = {}
        salaries: dict[str, list[float]] = defaultdict(list)
        counts: Counter[str] = Counter()
        mentions: dict[str, Counter[str]] = defaultdict(Counter)
        for row in rows:
            mapped = mapping.get(titles[row["job_id"]])
            if not mapped:
                continue
            soc, score, _ = mapped
            description = row.get("description", "")
            salary = annual_salary(row)
            counts[soc] += 1
            if salary:
                salaries[soc].append(salary)
            for name in matcher.find(description + " " + row.get("skills_desc", "")):
                mentions[soc][name] += 1
            listed = row.get("listed_time") or ""
            try:
                stamp = datetime.fromtimestamp(float(listed) / 1000, timezone.utc)
                listed = stamp.date().isoformat()
            except (ValueError, OverflowError, OSError):
                listed = None
            remote = row.get("remote_allowed")
            records.append((
                row["job_id"], soc, score, row["title"], row.get("company_name") or None,
                row.get("location") or None, row.get("formatted_experience_level") or None,
                row.get("formatted_work_type") or None,
                1 if remote in ("1", "1.0", "True", "true") else None,
                salary, listed, row.get("job_posting_url") or None,
                " ".join(description.split())[:400],
            ))
            texts[row["job_id"]] = f"{row['title']} {row['title']} {description[:3000]}"

        db.executescript(SCHEMA)
        db.executemany(
            "INSERT OR REPLACE INTO postings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            records)
        market = []
        for soc, total in counts.items():
            values = salaries[soc]
            stats = (_percentile(values, 25), round(statistics.median(values), -2),
                     _percentile(values, 75)) if len(values) >= 3 else (None, None, None)
            market.append((soc, total, len(values), *stats))
        db.executemany("INSERT INTO occupation_market VALUES (?, ?, ?, ?, ?, ?)", market)
        preferred = []
        for soc, counter in mentions.items():
            total = counts[soc]
            for name, n in counter.most_common(20):
                share = n / total
                if n >= 2 and share >= 0.05:
                    preferred.append((soc, name, n, round(share, 4),
                                      int(name in onet_software[soc])))
        db.executemany("INSERT INTO occupation_preferred VALUES (?, ?, ?, ?, ?)", preferred)
        meta = {
            "postings_source": POSTINGS_SOURCE, "postings_url": POSTINGS_URL,
            "postings_license": POSTINGS_LICENSE, "postings_license_url": POSTINGS_LICENSE_URL,
            "postings_attribution": POSTINGS_ATTRIBUTION,
            "postings_built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "postings_title_threshold": str(threshold),
        }
        db.executemany("INSERT OR REPLACE INTO meta VALUES (?, ?)", sorted(meta.items()))
        db.commit()

    indexed = 0
    if index_path is not None and records:
        if progress:
            progress(f"Building the search index ({min(len(records), max_index):,} postings)")
        indexed = build_index(texts, records, index_path, max_index)
    exact = sum(n for t, n in title_counts.items() if mapping.get(t, (0, 0))[1] == 1.0)
    return {
        "postings_read": len(rows), "postings_mapped": len(records),
        "mapped_exact": exact, "mapped_fuzzy": len(records) - exact,
        "occupations_with_postings": len(counts), "preferred_skills": len(preferred),
        "indexed": indexed,
    }


def write_mapping_report(path: Path, counts: Counter[str],
                         mapping: dict[str, tuple[str, float, str]],
                         occupation_titles: dict[str, str], top: int = 300) -> None:
    """Most common unmapped and fuzzy-matched titles, for checking the mapping by eye."""
    unmapped = [(t, n) for t, n in counts.most_common() if t not in mapping][:top]
    fuzzy = [(t, n) for t, n in counts.most_common()
             if t in mapping and mapping[t][1] < 1.0][:top]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["kind", "normalized_title", "postings", "soc", "onet_title",
                         "matched_onet_title", "score"])
        for title, n in unmapped:
            writer.writerow(["unmapped", title, n, "", "", "", ""])
        for title, n in fuzzy:
            soc, score, matched = mapping[title]
            writer.writerow(["fuzzy", title, n, soc, occupation_titles.get(soc, ""), matched,
                             score])


def build_index(texts: dict[str, str], records: list[tuple], index_path: Path,
                max_index: int) -> int:
    import joblib
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer

    # Newest postings first when capping the index size.
    ordered = sorted(records, key=lambda r: r[10] or "", reverse=True)[:max_index]
    job_ids = [r[0] for r in ordered]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english",
                                 min_df=2, max_features=40_000, dtype=np.float32)
    matrix = vectorizer.fit_transform([clean_text(texts[j]) for j in job_ids])
    index_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"vectorizer": vectorizer, "matrix": matrix, "job_ids": job_ids}, index_path)
    return len(job_ids)
