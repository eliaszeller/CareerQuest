# Career data

Raw downloads live in `data/raw/` and built files in `data/processed/`. Both are
git-ignored and excluded from the shareable ZIP; rebuild them with the scripts below.

## Sources

| Source | Version | License | Used for | Status |
| --- | --- | --- | --- | --- |
| [O*NET 31.0 Database](https://www.onetcenter.org/database.html) (USDOL/ETA) | 31.0 CSV | [CC BY 4.0](https://www.onetcenter.org/license_db.html) | Occupations, alternate titles, essential and transferable skills, knowledge, software, job zones, related occupations | Phase 1, built |
| [LinkedIn Job Postings (2023 - 2024)](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings) by arshkon | Kaggle | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Salary ranges, preferred skills, posting retrieval | Phase 3, built (you supply the download) |
| Resume Dataset (Resume.csv, 2,484 resumes, 24 categories), as loaded by the notebook below | Kaggle | Not confirmed; public on Kaggle, used for this class project with credit | Resume category classifier | Phase 2, built (you supply the CSV) |
| [Text-based Resume Filtering Tool](https://www.kaggle.com/code/hasanz9/text-based-resume-filtering-tool) by Nivetha Thangaraj, Hasan Zafar and Arian Riyahivafa | Kaggle notebook | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) | TF-IDF matching approach, adapted in `app/resume/training.py` and `app/services/occupation_match.py` | Phase 2, built |

## Required attribution

Show this wherever O*NET content appears (the API returns it in every `source` field):

> This page includes information from the O*NET 31.0 Database by the U.S. Department of
> Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY 4.0
> license. O*NET® is a trademark of USDOL/ETA. CareerQuest has modified all or some of
> this information. USDOL/ETA has not approved, endorsed, or tested these modifications.

Changes we make to O*NET data: we keep only the files listed above, drop ratings flagged
"Recommend Suppress" or "Not Relevant", combine the Importance (IM, 1-5) and Level (LV, 0-7)
scales into one row per skill, and mark a skill "required" when its Importance is 3.0 or higher.

Share-alike: anything derived from the LinkedIn postings that we share (processed tables,
embeddings, training pairs, a fine-tuned model) must also be released under CC BY-SA 4.0
with credit to the dataset. The app's code is not affected.

## Build the O*NET database

From `backend`, with the backend environment active:

    python scripts/download_onet.py          # saves data/raw/onet/db_31_0_csv.zip
    python scripts/build_career_db.py        # writes data/processed/careers.db

If the download script is blocked, download "All files" as CSV from the O*NET database
page, save it as `data/raw/onet/db_31_0_csv.zip`, and run the build script. The build
also accepts an unzipped folder: `python scripts/build_career_db.py --source <folder>`.

## Train the resume classifier (Phase 2)

1. On Kaggle, open the notebook's input "resume-dataset" and download it. Copy
   `Resume/Resume.csv` to `data/raw/resumes/Resume.csv`. The PDFs and HTML are not needed.
2. From `backend`, install the extra once: `python -m pip install -e ".[dev,resume,career]"`.
3. Run `python scripts/train_resume_classifier.py`.

This writes `backend/models/resume_classifier.joblib` and a `.metrics.json` report with
held-out accuracy, macro F1, top-3 accuracy and a KNN baseline. Do not redistribute
Resume.csv or the trained model outside the class project.

## Add the LinkedIn job postings (Phase 3)

1. Download the dataset zip from Kaggle and either unzip it into `data/raw/linkedin/` or
   pass the zip itself with `--source`. Only `postings.csv` is read.
2. With `careers.db` built and the `career` extra installed, run from `backend`:
   `python scripts/build_posting_index.py`

This maps each posting title to an O*NET occupation, then stores per-occupation salary
percentiles (annualized USD), the share of postings naming each O*NET software skill
("preferred" skills) and short posting snippets in `careers.db`. It also writes
`data/processed/postings_index.joblib`, a TF-IDF index of the newest 60,000 mapped
postings. The script prints how many postings it mapped; raise or lower `--threshold`
(default 0.6) to trade coverage for accuracy. It also writes
`data/processed/postings_mapping_report.csv` with the most common fuzzy and unmapped titles
so you can spot-check the mapping. These derived files are CC BY-SA 4.0.

## Fine-tuning data (Phase 4)

With postings built, run from `backend`: `python scripts/build_finetune_pairs.py`. It writes
`data/processed/finetune/`:

- `corpus.jsonl`: one short document per O*NET occupation (the retrieval targets).
- `train.jsonl`: query/occupation pairs from O*NET alternate titles and from postings whose
  title mapped exactly or by phrase (fuzzy mappings are left out to keep labels clean).
- `eval.jsonl`: up to 2,000 held-out postings, split by job id before training pairs are made.
- `skills.jsonl`: posting text with the O*NET software names found in it (weak labels for the
  LoRA notebook).

`python scripts/eval_retrieval.py` reports the TF-IDF baseline (Recall@1/5/10, MRR@10).
Train in `notebooks/finetune_embedder.ipynb` (and optionally `notebooks/lora_skill_extractor.ipynb`)
on a free Colab or Kaggle GPU. These files and any model trained on them are derived from
the CC BY-SA postings: share them only under CC BY-SA 4.0 with credit, within the class project.

