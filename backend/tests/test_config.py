import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_valid_configuration_parses_cors_origins_as_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:5173"]


def test_missing_database_url_raises_named_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert "database_url" in str(exc_info.value).lower()


def test_defaults_are_loopback_host_and_8000_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo")
    monkeypatch.delenv("BACKEND_HOST", raising=False)
    monkeypatch.delenv("BACKEND_PORT", raising=False)
    settings = Settings(_env_file=None)
    assert settings.backend_host == "127.0.0.1"
    assert settings.backend_port == 8000


def test_backend_host_0_0_0_0_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo")
    monkeypatch.setenv("BACKEND_HOST", "0.0.0.0")  # noqa: S104
    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert "loopback" in str(exc_info.value).lower()


def test_backend_host_localhost_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo")
    monkeypatch.setenv("BACKEND_HOST", "localhost")
    settings = Settings(_env_file=None)
    assert settings.backend_host == "localhost"


def test_cors_origins_wildcard_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert "*" in str(exc_info.value)


def test_cors_origins_multiple_comma_separated(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:5173", "http://localhost:5174"]
