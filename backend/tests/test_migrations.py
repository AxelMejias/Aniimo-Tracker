from collections.abc import Iterator

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

import app.infrastructure.modelos  # noqa: F401
from alembic import command
from app.infrastructure.database import Base

TABLAS_DEL_MODELO = {
    "usuario",
    "team",
    "aniimo_del_team",
    "material_estrella",
    "objeto_transportado",
}


@pytest.fixture
def base_migrable(migrated_engine: Engine, alembic_config: Config) -> Iterator[Engine]:
    yield migrated_engine
    command.upgrade(alembic_config, "head")


def test_upgrade_head_crea_las_tablas_del_modelo(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")
    assert set(inspect(base_migrable).get_table_names()) == TABLAS_DEL_MODELO | {"alembic_version"}


def test_downgrade_base_deja_solo_alembic_version(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "base")
    assert inspect(base_migrable).get_table_names() == ["alembic_version"]


def test_upgrade_es_repetible_despues_de_un_downgrade(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")
    assert TABLAS_DEL_MODELO <= set(inspect(base_migrable).get_table_names())


def test_constraints_siguen_la_convencion_de_nombres(migrated_engine: Engine) -> None:
    inspector = inspect(migrated_engine)
    nombres_vistos = {"uq": 0, "ck": 0, "fk": 0, "pk": 0}
    for tabla in TABLAS_DEL_MODELO:
        for constraint in inspector.get_unique_constraints(tabla):
            assert str(constraint["name"]).startswith(f"uq_{tabla}_")
            nombres_vistos["uq"] += 1
        for constraint in inspector.get_check_constraints(tabla):
            assert str(constraint["name"]).startswith(f"ck_{tabla}_")
            nombres_vistos["ck"] += 1
        for fk in inspector.get_foreign_keys(tabla):
            assert str(fk["name"]).startswith(f"fk_{tabla}_")
            nombres_vistos["fk"] += 1
        assert inspector.get_pk_constraint(tabla)["name"] == f"pk_{tabla}"
        nombres_vistos["pk"] += 1
    assert all(cantidad > 0 for cantidad in nombres_vistos.values())


@pytest.mark.parametrize(
    ("tabla", "nombre"),
    [
        ("usuario", "uq_usuario_nombre_usuario"),
        ("team", "uq_team_usuario_id_orden"),
        ("aniimo_del_team", "uq_aniimo_del_team_team_id_slot"),
    ],
)
def test_los_unique_que_traduce_la_uow_tienen_nombre_estable(
    migrated_engine: Engine, tabla: str, nombre: str
) -> None:
    nombres = {c["name"] for c in inspect(migrated_engine).get_unique_constraints(tabla)}
    assert nombre in nombres


def test_modelos_y_migracion_coinciden(migrated_engine: Engine) -> None:
    with migrated_engine.connect() as connection:
        diferencias = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    assert diferencias == []
