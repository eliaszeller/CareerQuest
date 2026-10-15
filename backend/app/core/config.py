from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "CareerQuest API"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    frontend_origin: str = "http://localhost:5173"
    database_url: str = "sqlite:///./careerquest.db"
    session_secret: str = "development-only-change-me"

    text_model_url: str = "http://127.0.0.1:9001"
    text_model_name: str = "Qwen3.6-35B-A3B"
    image_model_url: str = "http://127.0.0.1:9006"
    image_model_name: str = "FLUX.2-klein-4B"
    tts_model_url: str = "http://127.0.0.1:9008"
    tts_model_name: str = "Chatterbox-Multilingual-V3"
    tts_enabled: bool = False

    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1)
    upload_temp_ttl_seconds: int = Field(default=900, ge=60, le=3600)


@lru_cache
def get_settings() -> Settings:
    return Settings()

