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
8. Download the fine-tuned embedder.

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

The trained model is too large for git, so it's published as a GitHub Release asset. From `backend`, with the venv active:

```bash
curl -L -o careerquest-embedder.zip https://github.com/eliaszeller/CareerQuest/releases/download/mvp-model/careerquest-embedder.zip
python -m zipfile -e careerquest-embedder.zip models/
mv models/careerquest-embedder models/embedder
rm careerquest-embedder.zip
python -m pip install -e ".[finetune]"
python scripts/eval_retrieval.py --model models/embedder    # optional; needs steps 5-6 and build_finetune_pairs.py
```

You can also download the zip from the repo's Releases page. Unzip it, rename the `careerquest-embedder` folder to `embedder`, and move it into `backend/models/`. Check that `backend/models/embedder/config.json` exists, since a common mistake is ending up with one folder too many.

Restart the backend. The first résumé upload afterwards takes about a minute while occupation vectors are cached. Without the embedder, résumé suggestions fall back to TF-IDF.

**License:** the model is fine-tuned from `BAAI/bge-small-en-v1.5` (MIT) on pairs derived from the LinkedIn Job Postings dataset (arshkon, CC BY-SA 4.0) and O\*NET 31.0 (CC BY 4.0). Share it only under CC BY-SA 4.0, with credit to those sources.

To retrain it instead: from `backend`, run `python scripts/build_finetune_pairs.py`. Then run `notebooks/finetune_embedder.ipynb` on Google Colab with a GPU runtime, uploading `corpus.jsonl`, `train.jsonl` and `eval.jsonl` from `data/processed/finetune/`. It takes about 2 minutes on an A100 and 15 minutes on a free T4.

## Try the product

A 10-minute walkthrough once setup is done:

1. **Start both servers.** In Git Bash window 1, from `backend` with the venv active, run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`. In window 2, from `frontend`, run `npm run dev -- --host 127.0.0.1`. Then open http://127.0.0.1:5173.
2. **Take the survey (optional).** Click **Career survey** in the top bar and answer the 30 statements. Your top career fields carry into the quest's role suggestions.
3. **Build your character.** Click **Start your quest**, choose the résumé option, and upload `backend/tests/fixtures/sample-resume.txt` (a made-up data-analytics student) or your own résumé. Review and edit each extracted item, then approve.
   - **Expect:** a "Where your résumé points" box with résumé categories and matching O\*NET occupations. For the sample résumé these should be data or analyst roles.
4. **Quest.** Pick a goal and a target role (for example "Data Analyst"), your priorities, budget and horizon, then click **Generate my 3 paths**.
5. **Paths.** At the top, the **Real-world check** panel shows the matched O\*NET occupation, the number of postings analyzed, the middle-half pay range, your skill match %, the skills you already show, the skills to build, and example postings. Below it, **Why this could fit** gives 3 to 5 points, each citing numbered facts. Open "Facts used" to see them. Pick a path to continue.
6. **Simulation.** Make a few choices to see the trade-offs, then click **View my roadmap**.
7. **Roadmap.** You get 12 actions over 90 days. With career data built, "Days 8–30" starts with "Build evidence for" your top missing skill.
8. **Sources.** Click **Data sources and credits** in the footer to see every dataset, its license and the required credits.

**When something is missing:**

| Missing | What you'll see |
| --- | --- |
| O\*NET database (step 5) | The Real-world check says the data isn't built yet. Paths show illustrative numbers, and the roadmap uses generic actions. |
| Job postings (step 6) | The Real-world check shows skills but "Not built" for postings and "Not enough data" for pay. |
| Résumé classifier (step 7) | No résumé categories in "Where your résumé points". Occupation matches still appear if O\*NET is built. |
| Embedder (step 8) | Occupation matches use TF-IDF instead, so they are less accurate but still work. |
| Ollama or another text model | "Why this could fit" shows a standard summary, and "Facts used" says "standard summary" instead of "written by …". |
| Backend not running | Résumé upload fails, and the Real-world check says the data isn't built yet. Check that window 1 is still running. |

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

Run these from the repo root, with the backend venv active for the Python lines:

```bash
cd backend
pytest                                               # runs all backend tests on small sample data (no real datasets needed)
ruff check .                                         # checks the Python code for style problems and common bugs
python scripts/export_character_contract.py --check  # confirms the frontend's character types still match the backend
python scripts/export_career_contract.py --check     # same check for the career data types
python scripts/export_survey_contract.py --check     # same check for the survey catalog and types
cd ../frontend
npm run test:unit                                    # runs the frontend unit tests
npm run build                                        # type-checks the frontend and builds it, failing on any error
npx playwright install chromium                      # one-time: downloads the browser used for end-to-end tests
npm run test:e2e                                     # clicks through the app in a real browser (needs the steps above)
```

If a `--check` fails after you change a backend schema, run the same script without `--check` to regenerate the types. CI runs everything except the end-to-end tests on every push.

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
