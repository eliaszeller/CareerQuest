from functools import lru_cache
from pathlib import Path

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
    # Built offline by scripts/build_career_db.py; the API opens it read-only.
    career_db_path: str = str(
        Path(__file__).resolve().parents[3] / "data" / "processed" / "careers.db"
    )
    session_secret: str = "development-only-change-me"

    text_model_url: str = "http://127.0.0.1:9001"
    text_model_name: str = "Qwen3.6-35B-A3B"
    # Career explanations ask the text model first and fall back to a template.
    text_model_timeout_seconds: float = Field(default=30, gt=0, le=300)
    image_model_url: str = "http://127.0.0.1:9006"
    image_model_name: str = "FLUX.2-klein-4B"
    tts_model_url: str = "http://127.0.0.1:9008"
    tts_model_name: str = "Chatterbox-Multilingual-V3"
    tts_enabled: bool = False

    # Written by scripts/build_posting_index.py; posting search falls back to titles without it.
    postings_index_path: str = str(
        Path(__file__).resolve().parents[3] / "data" / "processed" / "postings_index.joblib"
    )
    # Written by scripts/train_resume_classifier.py; suggestions are skipped without it.
    resume_model_path: str = str(
        Path(__file__).resolve().parents[2] / "models" / "resume_classifier.joblib"
    )

    # Fine-tuned in notebooks/finetune_embedder.ipynb; resume matching uses TF-IDF without it.
    embedder_model_path: str = str(Path(__file__).resolve().parents[2] / "models" / "embedder")

    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1)
    upload_temp_ttl_seconds: int = Field(default=900, ge=60, le=3600)


@lru_cache
def get_settings() -> Settings:
    return Settings()

