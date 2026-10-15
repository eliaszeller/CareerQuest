from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.schemas.common import HealthResponse, ServiceStatus

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(
        service=settings.app_name,
        version="0.1.0",
        models=[
            ServiceStatus(
                name=settings.text_model_name,
                configured=bool(settings.text_model_url),
                required=True,
            ),
            ServiceStatus(
                name=settings.image_model_name,
                configured=bool(settings.image_model_url),
                required=True,
            ),
            ServiceStatus(
                name=settings.tts_model_name,
                configured=settings.tts_enabled,
                required=False,
            ),
        ],
    )
