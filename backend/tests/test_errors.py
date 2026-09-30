import logging

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def _client_with_boom_route(test_settings: Settings) -> TestClient:
    app = create_app(test_settings)

    @app.get("/api/boom")
    def boom() -> None:
        raise RuntimeError("secreto-interno")

    return TestClient(app, raise_server_exceptions=False)


def test_unhandled_exception_returns_generic_500(test_settings: Settings) -> None:
    client = _client_with_boom_route(test_settings)
    response = client.get("/api/boom")
    assert response.status_code == 500
    assert response.json() == {"detail": "Error interno del servidor"}
    assert "secreto-interno" not in response.text


def test_unhandled_exception_is_logged(
    test_settings: Settings, caplog: pytest.LogCaptureFixture
) -> None:
    client = _client_with_boom_route(test_settings)
    with caplog.at_level(logging.ERROR):
        client.get("/api/boom")
    assert any("secreto-interno" in record.getMessage() for record in caplog.records)
