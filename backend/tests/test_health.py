from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def _client(test_settings: Settings) -> TestClient:
    return TestClient(create_app(test_settings))


def test_health_check_ok(test_settings: Settings) -> None:
    client = _client(test_settings)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_check_rejects_post(test_settings: Settings) -> None:
    client = _client(test_settings)
    response = client.post("/api/health")
    assert response.status_code == 405


def test_unknown_route_returns_json_404(test_settings: Settings) -> None:
    client = _client(test_settings)
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
