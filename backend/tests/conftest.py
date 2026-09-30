import os

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.core.config import Settings
from app.infrastructure.database import make_engine


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        DATABASE_URL="postgresql+psycopg://user:pass@127.0.0.1:5432/aniimo",
        _env_file=None,
    )


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    assert url, "Falta TEST_DATABASE_URL en el entorno"
    return url


@pytest.fixture(scope="session")
def test_engine(test_database_url: str) -> Engine:
    engine = make_engine(test_database_url)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "No se pudo conectar a la base de test. Levantá "
            "`docker compose up -d db-test` antes de correr los tests."
        ) from exc
    return engine
