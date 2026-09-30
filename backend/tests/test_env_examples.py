from pathlib import Path

from app.core.config import Settings

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"

PLACEHOLDER_VALUES = {"", "cambiar-me"}


def _read_example(path: Path) -> str:
    assert path.exists(), (
        f"Falta {path}. Crealo con las variables de backend/app/core/config.py, sin valores reales."
    )
    return path.read_text(encoding="utf-8")


def _value_of(content: str, key: str) -> str | None:
    for raw in content.splitlines():
        line = raw.strip()
        if line.startswith("#") or "=" not in line:
            continue
        found_key, _, value = line.partition("=")
        if found_key.strip() == key:
            return value.strip()
    return None


def test_root_env_example_has_no_real_password() -> None:
    content = _read_example(ROOT_DIR / ".env.example")
    value = _value_of(content, "POSTGRES_PASSWORD")
    assert value in PLACEHOLDER_VALUES, "POSTGRES_PASSWORD no debe tener un valor real"


def test_backend_env_example_has_no_real_secrets() -> None:
    content = _read_example(BACKEND_DIR / ".env.example")
    database_url = _value_of(content, "DATABASE_URL")
    assert database_url is not None, "Falta DATABASE_URL en backend/.env.example"
    assert ":cambiar-me@" in database_url or ":@" in database_url, (
        "DATABASE_URL en backend/.env.example no debe llevar una contraseña real"
    )
    secret_key = _value_of(content, "SECRET_KEY")
    assert secret_key in PLACEHOLDER_VALUES or secret_key is None, (
        "SECRET_KEY no debe tener un valor real"
    )


def test_every_settings_field_is_listed_in_backend_env_example() -> None:
    content = _read_example(BACKEND_DIR / ".env.example")
    for field_name in Settings.model_fields:
        env_var = field_name.upper()
        assert env_var in content, f"Falta {env_var} en backend/.env.example"
