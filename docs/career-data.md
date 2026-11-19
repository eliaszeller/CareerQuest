# Career data

The backend reads a read-only SQLite file, `data/processed/careers.db`, built offline from
the O*NET 31.0 CSV files by `backend/scripts/build_career_db.py`. Resume files and text are
never written to it. See [data/README.md](../data/README.md) for sources, licenses and the
required attribution.

## Routes

| Route | Returns |
| --- | --- |
| `GET /api/v1/careers/search?q=data analyst` | Occupations whose official or alternate titles match: exact, then prefix, then contains |
| `GET /api/v1/careers/{soc}` (for example `15-2051.00`) | Description, alternate titles, job zone, essential skills, transferable skills, knowledge, software, related occupations |
| `GET /api/v1/careers/explore/{category}` | Occupations for a survey category (starter mapping in `app/careers/families.py`) |
| `POST /api/v1/careers/skills/normalize` | Maps resume skill labels such as "Excel" to O*NET names such as "Microsoft Excel" |

Every response includes a `source` object with the O*NET attribution. When the database is
not built, these routes return 503 with build instructions; the rest of the app still works.

## Skill types

- **Required:** essential skills with O*NET Importance 3.0 or higher (3 = "Important").
- **Transferable:** O*NET transferable skills, ranked by Importance.
- **Preferred:** O*NET software named in at least 5% of an occupation's job postings (Phase 3).

## Resume extraction

When `careers.db` exists, the resume extractor also recognizes O*NET software names
mentioned anywhere in the resume text (for example "Epic Systems", "AutoCAD"). Single-word
aliases match case-sensitively and everyday words such as "Word" or "Outlook" are skipped.

## Tests

`tests/fixtures/onet_mini/` holds a three-occupation sample in the exact O*NET 31.0 CSV
format. Tests build a temporary database from it and never use a real `careers.db`.
After changing `app/schemas/career.py`, run `python scripts/export_career_contract.py`.

## Resume screener (Phase 2)

`POST /api/v1/characters/extract` now returns an optional `career_suggestions` block, and
the import panel shows it as "Where your résumé points":

- **Category:** top 3 of the Resume Dataset's 24 categories with probabilities, from a
  TF-IDF + logistic-regression model trained by `scripts/train_resume_classifier.py`.
- **Occupations:** the 5 O*NET occupations whose titles, description, skills and software
  are closest to the resume text (TF-IDF cosine), plus starter occupations for the top
  category from `app/resume/categories.py`.

Both parts are optional. Without `careers.db` there are no occupations; without the model
there are no categories; with neither the field is `null`. Resume text is only used in
memory for the request. The approach adapts "Text-based Resume Filtering Tool" by Nivetha
Thangaraj, Hasan Zafar and Arian Riyahivafa (Kaggle, Apache 2.0); see `app/resume/training.py`
for what changed.

## Job postings (Phase 3)

`scripts/build_posting_index.py` adds the LinkedIn postings to `careers.db`:

- **Title mapping:** posting titles are normalized (seniority words, shifts and suffixes
  removed, light singularizing), matched exactly against O*NET alternate titles, then by
  TF-IDF similarity to each occupation's titles. Unmatched postings are dropped.
- **Market data:** per occupation, the posting count, annual USD salary percentiles
  (25th, median, 75th; at least 3 salaries) and preferred skills: O*NET software named
  in at least 5% of its postings.

New routes:

| Route | Returns |
| --- | --- |
| `GET /api/v1/careers/{soc}` | now includes `market` (null until postings are built) |
| `POST /api/v1/careers/postings/search` | Postings most similar to a query, optionally within one occupation; uses the TF-IDF index or falls back to title matching |
| `POST /api/v1/careers/gap` | For an occupation and the user's skills: required, transferable, software and preferred skills marked have or missing, plus a coverage score |

The Paths screen shows a "Real-world check" panel for the chosen role: the matched O*NET
occupation, postings analyzed, the middle-half pay range, skill match, skills to build and
three example postings. When pay data exists it replaces the illustrative salary on each
path card. Fit, time and cost on the cards remain illustrative.

## Explanations, roadmap gaps and fine-tuning (Phase 4)

**Grounded explanations.** `POST /api/v1/careers/explain` takes `{soc, skills, goal}`.
The server first collects numbered facts (F1, F2, ...) from `careers.db`: what the
occupation does, its job zone, the most important skills, posting counts and pay, the tools
employers name, and the user's skill gap. It sends only those facts to the local text model
(`TEXT_MODEL_URL`, an OpenAI-compatible server such as Qwen on port 9001) and asks for 3 to 5
points that each cite fact ids. Points that cite unknown facts, or quote a number not found
in the facts they cite, are dropped. If the model is off, unreachable or fewer than two
points survive, a fixed template built from the same facts is returned instead
(`generated_by: "template"`). The Paths screen shows this as "Why this could fit", with
citation chips and a "Facts used" list.

**Skill gaps in the roadmap.** The roadmap looks up the same skill gap for the chosen role.
When it finds missing skills, Days 1-7 asks you to check how often postings mention them and
Days 8-30 becomes "Build evidence for <top missing skill>". Without career data the roadmap
is unchanged.

**Sources page.** "Data sources and credits" in the footer lists every dataset, its license
and the required credit text.

**Fine-tuning.** See data/README.md for building the pairs. `notebooks/finetune_embedder.ipynb`
fine-tunes `BAAI/bge-small-en-v1.5` with in-batch negatives and reports Recall@5 on held-out
postings before and after. Put the result in `backend/models/embedder/` and install
`sentence-transformers`; résumé career suggestions then rank occupations with it instead of
TF-IDF. `notebooks/lora_skill_extractor.ipynb` is a stretch experiment that LoRA-tunes
Qwen2.5-0.5B-Instruct to list the tools a posting asks for.

