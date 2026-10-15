# Architecture

CareerQuest is a modular monolith with a React/TypeScript client and FastAPI backend. The backend is the sole authority for session state, validation, file processing, career data, model access, and deterministic simulation rules.

## Model services

| Service | Default endpoint | Requirement | Responsibility |
|---|---|---|---|
| Qwen3.6-35B-A3B | `http://127.0.0.1:9001` | Required | Structured profiles, paths, explanations, guide, roadmap |
| FLUX.2 klein 4B | `http://127.0.0.1:9006` | Required | Optional-to-render game and character visuals |
| Chatterbox Multilingual V3 | `http://127.0.0.1:9008` | Feature flagged | Spoken narration |

Model processes are external dependencies and are not started by this repository. Adapters and deterministic fallbacks will isolate the application from model-specific APIs. Models never calculate resources, authorize requests, or query storage.

## API convention

- Base path: `/api/v1`
- JSON for normal requests; multipart only for document upload
- Strict schemas reject unexpected fields
- Stable, non-sensitive error codes will be added with feature routes
- OpenAPI documentation is available at `/docs` in development

## Data boundaries

SQLite will contain curated career data and session-scoped application state. Uploaded files and extracted document text must never be written to SQLite. Resume and score-report processing will use permission-restricted temporary storage and unconditional cleanup.

