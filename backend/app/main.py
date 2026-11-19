from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.careers import router as careers_router
from app.api.characters import router as characters_router
from app.api.health import router as health_router
from app.api.resume import router as resume_router
from app.api.survey import router as survey_router
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
app.include_router(characters_router, prefix="/api/v1")
app.include_router(survey_router, prefix="/api/v1")
app.include_router(careers_router, prefix="/api/v1")


@app.exception_handler(RequestValidationError)
async def invalid_request(_request, exc: RequestValidationError):
    # Pydantic's default errors include submitted values, which can contain résumé text.
    return JSONResponse(
        status_code=422,
        headers={"Cache-Control": "no-store"},
        content={
            "detail": "Check the profile fields and supported limits, then try again.",
            "fields": [list(error["loc"]) for error in exc.errors()],
        },
    )


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"name": "CareerQuest API", "docs": "/docs"}
