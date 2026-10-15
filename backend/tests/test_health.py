from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_required_and_optional_models() -> None:
    response = TestClient(app).get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert [model["required"] for model in body["models"]] == [True, True, False]

