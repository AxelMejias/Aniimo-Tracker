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


def _base_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo")
    monkeypatch.delenv("TOKEN_EXPIRE_MINUTES", raising=False)
    monkeypatch.delenv("SESSION_MAX_HOURS", raising=False)


def test_session_durations_default_to_30_minutes_and_12_hours(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _base_env(monkeypatch)
    settings = Settings(_env_file=None)
    assert settings.token_expire_minutes == 30
    assert settings.session_max_hours == 12


def test_session_durations_are_read_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_env(monkeypatch)
    monkeypatch.setenv("TOKEN_EXPIRE_MINUTES", "45")
    monkeypatch.setenv("SESSION_MAX_HOURS", "24")
    settings = Settings(_env_file=None)
    assert settings.token_expire_minutes == 45
    assert settings.session_max_hours == 24


@pytest.mark.parametrize(
    ("variable", "valor"),
    [
        ("TOKEN_EXPIRE_MINUTES", "0"),
        ("TOKEN_EXPIRE_MINUTES", "1441"),
        ("SESSION_MAX_HOURS", "0"),
        ("SESSION_MAX_HOURS", "169"),
    ],
)
def test_session_durations_out_of_range_name_the_variable(
    monkeypatch: pytest.MonkeyPatch, variable: str, valor: str
) -> None:
    _base_env(monkeypatch)
    monkeypatch.setenv(variable, valor)
    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert variable.lower() in str(exc_info.value).lower()


def test_inactivity_longer_than_absolute_cap_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_env(monkeypatch)
    monkeypatch.setenv("TOKEN_EXPIRE_MINUTES", "780")
    monkeypatch.setenv("SESSION_MAX_HOURS", "12")
    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)
    assert "inactividad" in str(exc_info.value).lower()


def test_inactivity_equal_to_absolute_cap_is_accepted(monkeypatch: pytest.MonkeyPatch) -> None:
    _base_env(monkeypatch)
    monkeypatch.setenv("TOKEN_EXPIRE_MINUTES", "720")
    monkeypatch.setenv("SESSION_MAX_HOURS", "12")
    assert Settings(_env_file=None).token_expire_minutes == 720
