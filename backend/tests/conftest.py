from pathlib import Path

import pytest

from app.careers.build import build_career_db
from app.core.config import get_settings

ONET_FIXTURE = Path(__file__).parent / "fixtures" / "onet_mini"


def _use_db(monkeypatch, path: Path) -> None:
    monkeypatch.setenv("CAREER_DB_PATH", str(path))
    get_settings.cache_clear()


def use_resume_model(monkeypatch, path: Path) -> None:
    monkeypatch.setenv("RESUME_MODEL_PATH", str(path))
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def no_career_db(tmp_path_factory, monkeypatch):
    """Keep tests independent of any careers.db or model built on the developer's machine."""
    missing = tmp_path_factory.mktemp("no-data")
    monkeypatch.setenv("RESUME_MODEL_PATH", str(missing / "missing.joblib"))
    monkeypatch.setenv("TEXT_MODEL_URL", "")  # explanations use the template in tests
    _use_db(monkeypatch, missing / "missing.db")
    yield
    get_settings.cache_clear()


@pytest.fixture
def career_db(tmp_path, monkeypatch) -> Path:
    target = tmp_path / "careers.db"
    build_career_db(ONET_FIXTURE, target)
    _use_db(monkeypatch, target)
    return target
