from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.resume import router as resume_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="CareerQuest API",
    description="Career guidance with deterministic simulation mechanics.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Request-ID"],
)
app.include_router(health_router, prefix="/api/v1")
app.include_router(resume_router, prefix="/api/v1")


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"name": "CareerQuest API", "docs": "/docs"}
