from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def _client(test_settings: Settings) -> TestClient:
    return TestClient(create_app(test_settings))


def test_preflight_from_allowed_origin_is_authorized(test_settings: Settings) -> None:
    client = _client(test_settings)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_preflight_from_disallowed_origin_is_not_authorized(test_settings: Settings) -> None:
    client = _client(test_settings)
    response = client.options(
        "/api/health",
        headers={
            "Origin": "http://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in response.headers
