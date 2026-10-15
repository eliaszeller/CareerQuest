from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.config import Settings, get_settings
from app.resume.extractor import ResumeError, process_upload
from app.schemas.resume import ResumeUploadResponse
from app.services.resume_profile import build_fallback_draft

router = APIRouter(prefix="/resume", tags=["resume"])


@router.post("/extract", response_model=ResumeUploadResponse)
async def extract_resume(
    file: UploadFile = File(...), settings: Settings = Depends(get_settings)
) -> ResumeUploadResponse:
    try:
        filename, text = await process_upload(file, settings.max_upload_bytes)
    except ResumeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    finally:
        await file.close()

    return ResumeUploadResponse(
        filename=filename,
        character_count=len(text),
        draft=build_fallback_draft(text),
        message="Your résumé was processed for this request and the temporary file was deleted.",
    )
