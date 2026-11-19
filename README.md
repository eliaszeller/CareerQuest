# CareerQuest

**Build your character. Explore your future. Plan your next move.**

CareerQuest is a proposed gamified, AI-assisted career progression simulator for people in high school, college, graduate/professional school, and the workforce.

## Current status

Milestone 2 now includes a unified character-builder MVP. Manual entry and résumé extraction produce the same versioned profile. Users can add education, experience, classes, projects, interests, hobbies, skills, and certifications; edit or remove imported suggestions; and explicitly approve their character. The builder supports desktop, mobile, and keyboard use.

See [the MVP implementation notes](docs/character-builder-mvp.md) for scope, privacy behavior, tests, and limitations. Career data integration and validated career recommendations are later milestones; the existing quest/simulation screens remain prototypes.

## Planning deliverables

- Concise product requirements
- Complete user flow
- Recommended architecture and folder structure
- Core data schemas
- Resume-processing security plan
- Deterministic simulation design
- AI prompt and validation strategy
- Testing strategy
- Milestone plan
- Risk register
- Team approval checklist

## Proposed MVP stack

- React, TypeScript, and Vite
- Tailwind CSS
- FastAPI and Pydantic
- SQLite
- OpenAI Responses API with deterministic fallbacks
- PyMuPDF, pypdf, and python-docx
- Pytest, Vitest, Playwright, axe-core

No secrets or private resume files should ever be committed.

## Run locally

Prerequisites: Python 3.10+ (3.12 recommended) and Node.js 22+.

```bash
cp .env.example .env
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev,resume]"
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. API documentation is at `http://localhost:8000/docs`.

The character builder needs both the frontend and backend. Résumés are sent to
the local FastAPI server, parsed without a model call, and temporary files are
deleted. The reviewed profile stays in browser memory; refresh/close clears it.
Users can explicitly download a JSON copy. Organization details are not sent to
external logo providers.

On Windows, activate the environment with `.venv\Scripts\Activate.ps1`, or run
`.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000` from `backend`.

The local model services are configured at ports 9001, 9006, and 9008, but the foundation can start without them. Chatterbox narration is disabled by default.

## Career data (O*NET)

Career search, skills and related occupations come from the O*NET 31.0 Database
(CC BY 4.0). Build the local database once from `backend`:

```bash
python scripts/download_onet.py
python scripts/build_career_db.py
```

For résumé career suggestions, install the `career` extra
(`pip install -e ".[dev,resume,career]"`), put Resume.csv in `data/raw/resumes/`, and run
`python scripts/train_resume_classifier.py`.

For job-posting pay and skills, unzip the Kaggle LinkedIn Job Postings download into
`data/raw/linkedin/` and run `python scripts/build_posting_index.py`.

See [data/README.md](data/README.md) and [docs/career-data.md](docs/career-data.md). Open items are in [docs/FUTURE_IMPROVEMENTS.md](docs/FUTURE_IMPROVEMENTS.md).

## Test

```bash
cd backend
pytest
ruff check app tests scripts
python scripts/export_character_contract.py --check
python scripts/export_career_contract.py --check
cd ../frontend
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
```

See [docs/architecture.md](docs/architecture.md) and [docs/project-plan.md](docs/project-plan.md) for the approved boundaries and implementation sequence.

## Career compass survey

The optional Career survey offers 30 original statements in six sections, explainable exploration across seven fields, and John Business as the mascot. Selected fields carry into quest role suggestions. [Question set and scoring notes](docs/career-survey-mvp.md).

After editing the canonical survey JSON or response schema, run `python backend/scripts/export_survey_contract.py` from the repository root with the backend environment active. CI checks generated catalog and contract consistency.

## Future improvements

The main open items are below. Details and the reasons for each are in [docs/FUTURE_IMPROVEMENTS.md](docs/FUTURE_IMPROVEMENTS.md).

- **AI-written explanations:** connect a local text model (for example Ollama with `qwen3:8b`) through `TEXT_MODEL_URL` and `TEXT_MODEL_NAME` in `.env`. Without one, "Why this could fit" shows a standard summary built from the same facts.
- **Real numbers on the Paths screen:** fit %, time and cost on each path card are still illustrative. Derive fit from skill-gap coverage, and fill the "Skills traverse" card from the real missing skills.
- **Survey mapping review:** check that the 7 survey categories in `backend/app/careers/families.py` point to sensible O*NET occupations.
- **Wider use of the fine-tuned embedder:** it ranks résumé suggestions today (Recall@5 0.82 versus 0.44 for TF-IDF). Use it for role search and posting search too.
- **Validation:** hand-label about 200 postings to measure title-mapping precision and to check the embedder against independent labels.
- **Optional LoRA skill extractor:** `notebooks/lora_skill_extractor.ipynb` is ready to run but not wired into the app.
- **Browser tests:** add a Playwright scenario covering résumé, then quest, then paths, then roadmap.
- **Licensing:** confirm the Resume Dataset license. Keep posting-derived files under CC BY-SA 4.0.
