# CareerQuest

**Build your character. Explore your future. Plan your next move.**

CareerQuest is a proposed gamified, AI-assisted career progression simulator for people in high school, college, graduate/professional school, and the workforce.

## Current status

Milestone 2 is underway. The repository includes a responsive landing page, onboarding routes, the first manual-character form, secure résumé extraction and review, strict domain schemas, model-service configuration, and automated tests.

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

Prerequisites: Python 3.9+ and Node.js 22+.

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

To display school and employer logos in character profiles, set the public
`VITE_LOGO_DEV_TOKEN` value in `.env`. Only organization domains or names are
sent to Logo.dev; résumé contents are never sent. Without a key, CareerQuest
uses Google's favicon service for recognized official domains. Initials remain
the fallback.

The local model services are configured at ports 9001, 9006, and 9008, but the foundation can start without them. Chatterbox narration is disabled by default.

## Test

```bash
cd backend && pytest
cd ../frontend && npm test -- --run
```

See [docs/architecture.md](docs/architecture.md) and [docs/project-plan.md](docs/project-plan.md) for the approved boundaries and implementation sequence.
