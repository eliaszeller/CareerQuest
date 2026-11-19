"""Load the trained resume category model, if it has been trained locally."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings
from app.resume.training import clean_text


@lru_cache(maxsize=2)
def _load(path: str, mtime: float):
    import joblib

    # Only ever load the model file this project's training script wrote.
    return joblib.load(path)


def predict_categories(text: str, top: int = 3) -> tuple[list[tuple[str, float]], str] | None:
    """Top resume categories with probabilities, or None if no model is available."""
    path = Path(get_settings().resume_model_path)
    try:
        bundle = _load(str(path), path.stat().st_mtime)
    except (FileNotFoundError, ImportError):
        return None
    pipeline = bundle["pipeline"]
    probabilities = pipeline.predict_proba([clean_text(text)])[0]
    ranked = sorted(zip(pipeline.classes_, probabilities), key=lambda pair: -pair[1])
    return [(str(label), float(p)) for label, p in ranked[:top]], bundle["model_version"]
