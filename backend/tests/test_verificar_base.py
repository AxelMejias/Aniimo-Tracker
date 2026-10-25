import socket
from collections.abc import Iterator

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from alembic import command
from app.verificar_base import problema_de_base


@pytest.fixture
def base_en_head(migrated_engine: Engine, alembic_config: Config) -> Iterator[Engine]:
    yield migrated_engine
    command.upgrade(alembic_config, "head")


def _head(engine: Engine, alembic_config: Config) -> str:
    with engine.connect() as conexion, Operations.context(MigrationContext.configure(conexion)):
        head = ScriptDirectory.from_config(alembic_config).get_current_head()
    assert head is not None
    return head


def _puerto_cerrado() -> int:
    with socket.socket() as cerrojo:
        cerrojo.bind(("127.0.0.1", 0))
        return int(cerrojo.getsockname()[1])


def test_con_la_base_en_la_ultima_revision_no_hay_problema(
    base_en_head: Engine, alembic_config: Config
) -> None:
    command.upgrade(alembic_config, "head")
    assert problema_de_base(base_en_head, alembic_config) is None


def test_con_la_base_en_una_revision_anterior_pide_alembic_upgrade_head(
    base_en_head: Engine, alembic_config: Config
) -> None:
    command.downgrade(alembic_config, "005")
    mensaje = problema_de_base(base_en_head, alembic_config)
    assert mensaje is not None
    assert "alembic upgrade head" in mensaje
    assert "005" in mensaje
    assert _head(base_en_head, alembic_config) in mensaje


def test_con_la_base_sin_migrar_tambien_pide_alembic_upgrade_head(
    base_en_head: Engine, alembic_config: Config
) -> None:
    command.downgrade(alembic_config, "base")
    mensaje = problema_de_base(base_en_head, alembic_config)
    assert mensaje is not None
    assert "alembic upgrade head" in mensaje
    assert _head(base_en_head, alembic_config) in mensaje


def test_sin_conexion_pide_levantar_la_base_y_no_filtra_la_contrasena(
    alembic_config: Config,
) -> None:
    # Sin connect_timeout libpq tarda ~130 s en rendirse en Windows ante un puerto cerrado.
    engine = create_engine(
        f"postgresql+psycopg://aniimo:contrasena-secreta-xyz@127.0.0.1:{_puerto_cerrado()}/aniimo",
        connect_args={"connect_timeout": 2},
    )
    try:
        mensaje = problema_de_base(engine, alembic_config)
    finally:
        engine.dispose()
    assert mensaje is not None
    assert "docker compose up -d db" in mensaje
    assert "contrasena-secreta-xyz" not in mensaje


def test_el_mensaje_de_desactualizada_no_contiene_la_url_de_la_base(
    base_en_head: Engine, alembic_config: Config, test_database_url: str
) -> None:
    command.downgrade(alembic_config, "005")
    mensaje = problema_de_base(base_en_head, alembic_config)
    assert mensaje is not None
    assert test_database_url not in mensaje
    assert "@" not in mensaje
