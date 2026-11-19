from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings, get_settings
from app.resume.extractor import ResumeError, process_upload
from app.schemas.career import CareerSuggestions
from app.schemas.character import CharacterProfile
from app.schemas.common import StrictModel
from app.services.career_suggestions import suggest_careers
from app.services.character_profile import build_character_draft

router = APIRouter(prefix="/characters", tags=["characters"])


class ExtractionResponse(StrictModel):
    profile: CharacterProfile
    warnings: list[str]
    # Optional: present only when the career data or resume model is built locally.
    career_suggestions: Optional[CareerSuggestions] = None


@router.post("/extract", response_model=ExtractionResponse)
async def extract_character(
    response: Response,
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
) -> ExtractionResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        _, text = await process_upload(file, settings.max_upload_bytes)
        profile, warnings = await run_in_threadpool(build_character_draft, text)
        try:
            suggestions = await run_in_threadpool(suggest_careers, text)
        except Exception:  # Suggestions are optional; never block profile extraction.
            suggestions = None
        return ExtractionResponse(
            profile=profile, warnings=warnings, career_suggestions=suggestions
        )
    except ResumeError as exc:
        raise HTTPException(422, detail=str(exc), headers={"Cache-Control": "no-store"}) from exc
    finally:
        await file.close()


@router.post("/approve", response_model=CharacterProfile)
def approve_character(profile: CharacterProfile, response: Response) -> CharacterProfile:
    """Validate and return the confirmed profile; never persist résumé data."""
    response.headers["Cache-Control"] = "no-store"
    data = profile.model_dump()
    data["approval_status"] = "approved"
    try:
        return CharacterProfile.model_validate(data)
    except ValidationError as exc:
        # Do not reflect user input or evidence in validation errors.
        raise HTTPException(
            422,
            detail="Add your name and life stage, then confirm or remove every suggestion.",
            headers={"Cache-Control": "no-store"},
        ) from exc
