import os
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.core.config import Settings
from app.domain.catalogos import PosicionObjeto, PotencialInnato, Rareza, Stat
from app.domain.entidades import (
    AniimoDelTeam,
    MaterialEstrella,
    ObjetoTransportado,
    ValoresDeStat,
)
from app.infrastructure.database import make_engine
from app.main import create_app
from tests.fabricas import ClienteAutenticado, HasherEspia, RelojFalso, autenticar

BACKEND_DIR = Path(__file__).resolve().parents[1]


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


@pytest.fixture(scope="session")
def alembic_config(test_database_url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["sqlalchemy.url"] = test_database_url
    return config


@pytest.fixture(scope="session")
def migrated_engine(test_engine: Engine, alembic_config: Config) -> Engine:
    command.upgrade(alembic_config, "head")
    return test_engine


@pytest.fixture
def session_factory(migrated_engine: Engine) -> Iterator[sessionmaker[Session]]:
    connection = migrated_engine.connect()
    outer = connection.begin()
    factory = sessionmaker(
        bind=connection,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    yield factory
    outer.rollback()
    connection.close()


@pytest.fixture
def reloj() -> RelojFalso:
    return RelojFalso()


@pytest.fixture
def hasher_espia() -> HasherEspia:
    return HasherEspia()


@pytest.fixture
def app_api(
    test_settings: Settings,
    session_factory: sessionmaker[Session],
    hasher_espia: HasherEspia,
    reloj: RelojFalso,
) -> FastAPI:
    return create_app(
        test_settings, session_factory=session_factory, hasher=hasher_espia, reloj=reloj
    )


@pytest.fixture
def cliente_api(app_api: FastAPI) -> TestClient:
    return TestClient(app_api)


@pytest.fixture
def irisalis() -> AniimoDelTeam:
    stats = {
        Stat.PS: ValoresDeStat(valor_actual=11321, potencial=11, bono_estrellas_incluido=120),
        Stat.ATQ: ValoresDeStat(valor_actual=723, potencial=20, notas="Tope de potencial"),
        Stat.DEF_FISICA: ValoresDeStat(valor_actual=258, potencial=5),
        Stat.DEF_MAGICA: ValoresDeStat(valor_actual=270, potencial=4),
        Stat.REGEN: ValoresDeStat(valor_actual=388, potencial=20, bono_estrellas_incluido=15),
        Stat.QUIEBRE: ValoresDeStat(valor_actual=309, potencial=6),
    }
    return AniimoDelTeam(
        team_id=uuid4(),
        slot=1,
        nombre="Irisalis",
        elemento=None,
        rol=None,
        potencial_innato=PotencialInnato.PERFECTO,
        personalidad="ENFJ",
        nivel=60,
        cp=3475,
        stats=stats,
        estrella_actual=2,
        nivel_requerido_siguiente_etapa=65,
        ganancia_despertar=3,
        ganancia_seis_potenciales=1,
        despertares_usados=28,
        despertares_total=43,
        materiales=(
            MaterialEstrella(posicion=1, nombre="Polvo estelar", tengo=413, necesito=60),
            MaterialEstrella(posicion=2, nombre="Fragmento", tengo=1, necesito=2),
            MaterialEstrella(posicion=3, nombre="Esencia", tengo=3, necesito=10),
        ),
        objetos=(
            ObjetoTransportado(
                posicion=PosicionObjeto.EQUIPADO,
                nombre="Corona antigua",
                rareza=Rareza.LEGENDARIA,
                nivel=15,
                contrato=True,
                efecto_nucleo_notas="Efecto de nucleo de prueba",
            ),
            ObjetoTransportado(
                posicion=PosicionObjeto.ALTERNATIVO,
                nombre="Anillo simple",
                rareza=Rareza.RARA,
                nivel=4,
            ),
        ),
        notas_habilidades="Habilidad 1: ataque electrico | Habilidad 2: curacion",
        notas="Aniimo de referencia",
    )


@pytest.fixture
def usuario_a(cliente_api: TestClient) -> ClienteAutenticado:
    return autenticar(cliente_api, "usuario_a")


@pytest.fixture
def usuario_b(cliente_api: TestClient) -> ClienteAutenticado:
    return autenticar(cliente_api, "usuario_b")
