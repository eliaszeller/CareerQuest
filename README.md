# CareerQuest

**Build your character. Explore your future. Plan your next move.**

CareerQuest is a gamified career exploration app for people in high school, college, graduate or professional school, and the workforce. You build a character from a résumé or by hand, pick a goal, compare three paths backed by real occupation and job-posting data, test your choices in a short simulation, and leave with a 90-day action plan.

## Current status (MVP branch)

What works today:

- **Character builder:** manual entry or PDF/DOCX/TXT résumé upload. Every extracted item can be edited, removed and approved. Résumé text is never stored.
- **Career survey:** 30 statements scored across 7 broad career fields, which feed role suggestions.
- **Real career data:** the O\*NET 31.0 database supplies required, transferable and software skills for about 1,000 occupations. About 124,000 LinkedIn postings (2023 to 2024) are mapped to those occupations for pay ranges, the tools employers ask for, and example postings.
- **Résumé screener:** a classifier suggests résumé categories, and a fine-tuned embedder suggests matching O\*NET occupations (Recall@5 0.82, versus 0.44 for TF-IDF).
- **Paths screen:** a "Real-world check" panel with pay, skill match, skills to build, example postings, and a cited "Why this could fit" explanation.
- **Roadmap:** a 12-action, 90-day plan that targets your real skill gaps.
- **Sources page:** dataset credits and licenses (footer link).

Still illustrative: the fit %, time and cost values on each path card, and the simulation. See [Future improvements](#future-improvements).

## First-time setup checklist

Do these in order. Steps 1 to 4 get the app running. Steps 5 to 8 add the real career data, which the Paths, résumé suggestions and roadmap features need. Without them those panels say the data isn't built yet.

1. Install the prerequisites (below).
2. Clone the repo and switch to the `MVP` branch.
3. Set up the backend.
4. Set up the frontend, start both, and open the app.
5. Build the O\*NET database.
6. Add the LinkedIn job postings.
7. Train the résumé classifier.
8. Add the fine-tuned embedder.

### 1. Prerequisites

- **Python 3.12.** Use 3.12 specifically: Python 3.14 fails to install `pydantic-core`.
- **Node.js 22 or newer.**
- **Git.** On Windows, use Git Bash for every command below.
- **A free Kaggle account** for the postings and résumé datasets.

### 2. Get the code

```bash
git clone https://github.com/eliaszeller/CareerQuest.git
cd CareerQuest
git checkout MVP
cp .env.example .env
```

### 3. Backend

```bash
cd backend
py -3.12 -m venv .venv            # macOS/Linux: python3.12 -m venv .venv
source .venv/Scripts/activate     # macOS/Linux: source .venv/bin/activate
python -m pip install -e ".[dev,resume,career]"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Leave this terminal running. In each new terminal, run `source .venv/Scripts/activate` from `backend` again before any `python` command. API docs are at http://127.0.0.1:8000/docs.

### 4. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173. Keep both terminals running.

### 5. O\*NET database

From `backend`, with the venv active:

```bash
python scripts/download_onet.py      # or download db_31_0_csv.zip from onetcenter.org into data/raw/onet/
python scripts/build_career_db.py
```

### 6. LinkedIn job postings

Download [LinkedIn Job Postings (2023 - 2024)](https://www.kaggle.com/datasets/arshkon/linkedin-job-postings) from Kaggle and unzip it into `data/raw/linkedin/`. Only `postings.csv` is read. Then, from `backend`:

```bash
python scripts/build_posting_index.py
```

This maps about 85% of postings to O\*NET occupations and takes a few minutes.

### 7. Résumé classifier

Open the Kaggle notebook [Text-based Resume Filtering Tool](https://www.kaggle.com/code/hasanz9/text-based-resume-filtering-tool), download its "resume-dataset" input, and copy `Resume/Resume.csv` to `data/raw/resumes/Resume.csv`. Then, from `backend`:

```bash
python scripts/train_resume_classifier.py
```

This writes `backend/models/resume_classifier.joblib`. Don't commit or share Resume.csv or the model.

### 8. Fine-tuned embedder

The trained model is not in git. To get it, do one of these:

- **Ask James for `careerquest-embedder.zip`.** This is quicker.
- **Train it yourself.** From `backend`, run `python scripts/build_finetune_pairs.py`. Then run `notebooks/finetune_embedder.ipynb` on Google Colab with a GPU runtime, uploading `corpus.jsonl`, `train.jsonl` and `eval.jsonl` from `data/processed/finetune/`. It takes about 2 minutes on an A100 and 15 minutes on a free T4.

Unzip it so the files sit directly in `backend/models/embedder/` (that folder should contain `config.json`). Then install the extra and check it:

```bash
python -m pip install -e ".[finetune]"
python scripts/eval_retrieval.py --model models/embedder    # expect recall@5 of about 0.82
```

Restart the backend. The first résumé upload afterwards takes about a minute while occupation vectors are cached. Without the embedder, résumé suggestions fall back to TF-IDF.

## Next step for the group: AI-written explanations

"Why this could fit" on the Paths screen shows a standard summary until a local text model is connected. To connect one with [Ollama](https://ollama.com):

1. Install Ollama, then run `ollama pull qwen3:8b`.
2. Add these lines to `.env` in the repo root:
   ```
   TEXT_MODEL_URL=http://127.0.0.1:11434
   TEXT_MODEL_NAME=qwen3:8b
   ```
3. Restart the backend and open a path. The facts list under the explanation should say "written by qwen3:8b".

Any server that accepts OpenAI-style `/v1/chat/completions` requests works, including LM Studio, llama.cpp and vLLM. This hasn't been tested against a live server yet.

## Test

```bash
cd backend
pytest
ruff check .
python scripts/export_character_contract.py --check
python scripts/export_career_contract.py --check
python scripts/export_survey_contract.py --check
cd ../frontend
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests use small fixtures and never need the real datasets. CI runs the unit tests on every push.

## Privacy and data

- Résumés are parsed locally, temporary files are deleted, and the reviewed profile stays in browser memory. Users can download a JSON copy.
- Raw downloads (`data/raw/`), built databases and indexes (`data/processed/`), trained models (`backend/models/`), `.venv`, `node_modules` and `.env` are git-ignored. Never commit them, secrets or real résumés.
- Posting-derived files are CC BY-SA 4.0. O\*NET data is CC BY 4.0 and needs the attribution in [data/README.md](data/README.md).

More detail: [data/README.md](data/README.md) (sources, licenses, rebuild steps), [docs/career-data.md](docs/career-data.md) (routes and how the data is used), [docs/architecture.md](docs/architecture.md), [docs/career-survey-mvp.md](docs/career-survey-mvp.md) and [docs/character-builder-mvp.md](docs/character-builder-mvp.md).

## Future improvements

The main open items are below. Details and the reasons for each are in [docs/FUTURE_IMPROVEMENTS.md](docs/FUTURE_IMPROVEMENTS.md).

- **AI-written explanations:** connect a local text model (see the section above).
- **Real numbers on the Paths screen:** fit %, time and cost on each path card are still illustrative. Derive fit from skill-gap coverage, and fill the "Skills traverse" card from the real missing skills.
- **Survey mapping review:** check that the 7 survey categories in `backend/app/careers/families.py` point to sensible O\*NET occupations.
- **Wider use of the fine-tuned embedder:** it ranks résumé suggestions today. Use it for role search and posting search too.
- **Validation:** hand-label about 200 postings to measure title-mapping precision and to check the embedder against independent labels.
- **Optional LoRA skill extractor:** `notebooks/lora_skill_extractor.ipynb` is ready to run but not wired into the app.
- **Browser tests:** add a Playwright scenario covering résumé, then quest, then paths, then roadmap.
- **Licensing:** confirm the Resume Dataset license. Keep posting-derived files under CC BY-SA 4.0.
