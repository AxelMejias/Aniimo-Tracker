from collections.abc import Iterator
from uuid import uuid4

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

import app.infrastructure.modelos  # noqa: F401
from alembic import command
from app.infrastructure.database import Base

TABLAS_CORE = {
    "usuario",
    "team",
    "aniimo_del_team",
    "material_estrella",
    "objeto_transportado",
}
TABLAS_CON_SESION = TABLAS_CORE | {"sesion"}
TABLAS_CON_IMAGEN = TABLAS_CON_SESION | {"imagen_aniimo"}
TABLAS_DEL_MODELO = TABLAS_CON_IMAGEN | {"amistad"}


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


def test_downgrade_a_004_quita_amistad_y_las_columnas_de_privacidad(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "004")
    inspector = inspect(base_migrable)
    assert set(inspector.get_table_names()) == TABLAS_CON_IMAGEN | {"alembic_version"}
    assert "oculto_para_amigos" not in _columnas(base_migrable, "team")
    assert "notas_privadas" not in _columnas(base_migrable, "aniimo_del_team")


def test_upgrade_head_agrega_las_columnas_de_privacidad(base_migrable: Engine) -> None:
    team = _columnas(base_migrable, "team")["oculto_para_amigos"]
    aniimo = _columnas(base_migrable, "aniimo_del_team")["notas_privadas"]
    for columna in (team, aniimo):
        assert columna["nullable"] is False
        assert "false" in str(columna["default"]).lower()


def test_los_datos_creados_en_004_quedan_visibles_tras_005(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.downgrade(alembic_config, "004")
    try:
        aniimo_id = _crear_aniimo_con_rol(base_migrable, "dps")
        command.upgrade(alembic_config, "head")
        with base_migrable.connect() as connection:
            oculto, privadas = connection.execute(
                text(
                    "SELECT t.oculto_para_amigos, a.notas_privadas FROM aniimo_del_team a "
                    "JOIN team t ON t.id = a.team_id WHERE a.id = :id"
                ),
                {"id": aniimo_id},
            ).one()
        assert (oculto, privadas) == (False, False)
    finally:
        _limpiar_usuarios(base_migrable)


def test_los_constraints_de_amistad_tienen_el_nombre_de_la_convencion(
    migrated_engine: Engine,
) -> None:
    inspector = inspect(migrated_engine)
    checks = {c["name"] for c in inspector.get_check_constraints("amistad")}
    assert checks == {
        "ck_amistad_par_ordenado",
        "ck_amistad_solicitante_en_par",
        "ck_amistad_estado",
        "ck_amistad_aceptada_en_coherente",
    }
    uniques = {c["name"] for c in inspector.get_unique_constraints("amistad")}
    assert uniques == {"uq_amistad_usuario_a_id_usuario_b_id"}
    fks = inspector.get_foreign_keys("amistad")
    assert {(fk["name"], fk["options"].get("ondelete")) for fk in fks} == {
        ("fk_amistad_usuario_a_id_usuario", "CASCADE"),
        ("fk_amistad_usuario_b_id_usuario", "CASCADE"),
    }


def test_downgrade_a_002_quita_solo_imagen_aniimo(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "002")
    assert set(inspect(base_migrable).get_table_names()) == TABLAS_CON_SESION | {"alembic_version"}


def test_downgrade_de_dos_pasos_quita_imagen_y_sesion(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.upgrade(alembic_config, "head")
    command.downgrade(alembic_config, "001")
    assert set(inspect(base_migrable).get_table_names()) == TABLAS_CORE | {"alembic_version"}


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
        ("sesion", "uq_sesion_token_hash"),
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


def test_los_constraints_de_sesion_tienen_el_nombre_de_la_convencion(
    migrated_engine: Engine,
) -> None:
    inspector = inspect(migrated_engine)
    checks = {c["name"] for c in inspector.get_check_constraints("sesion")}
    assert checks == {"ck_sesion_vence_despues_de_crear", "ck_sesion_expira_hasta_el_tope"}
    fks = {fk["name"] for fk in inspector.get_foreign_keys("sesion")}
    assert fks == {"fk_sesion_usuario_id_usuario"}


def test_los_constraints_de_imagen_tienen_el_nombre_de_la_convencion(
    migrated_engine: Engine,
) -> None:
    inspector = inspect(migrated_engine)
    checks = {c["name"] for c in inspector.get_check_constraints("imagen_aniimo")}
    assert checks == {"ck_imagen_aniimo_tipo", "ck_imagen_aniimo_tamano"}
    fks = inspector.get_foreign_keys("imagen_aniimo")
    assert [(fk["name"], fk["options"].get("ondelete")) for fk in fks] == [
        ("fk_imagen_aniimo_aniimo_del_team_id_aniimo_del_team", "CASCADE")
    ]
    assert inspector.get_pk_constraint("imagen_aniimo")["constrained_columns"] == [
        "aniimo_del_team_id"
    ]


def _columnas(engine: Engine, tabla: str) -> dict[str, dict[str, object]]:
    return {c["name"]: dict(c) for c in inspect(engine).get_columns(tabla)}


def _crear_aniimo_con_rol(engine: Engine, rol: str | None) -> str:
    with engine.begin() as connection:
        usuario_id = connection.execute(
            text(
                "INSERT INTO usuario (id, nombre_usuario, password_hash) "
                "VALUES (gen_random_uuid(), :nombre, 'x') RETURNING id"
            ),
            {"nombre": f"u{uuid4().hex[:12]}"},
        ).scalar_one()
        team_id = connection.execute(
            text(
                "INSERT INTO team (id, usuario_id, nombre, orden) "
                "VALUES (gen_random_uuid(), :u, 'T', 1) RETURNING id"
            ),
            {"u": usuario_id},
        ).scalar_one()
        return str(
            connection.execute(
                text(
                    "INSERT INTO aniimo_del_team (id, team_id, slot, nombre, rol) "
                    "VALUES (gen_random_uuid(), :t, 1, 'A', :rol) RETURNING id"
                ),
                {"t": team_id, "rol": rol},
            ).scalar_one()
        )


def _rol_de(engine: Engine, aniimo_id: str) -> str | None:
    with engine.connect() as connection:
        return connection.execute(
            text("SELECT rol FROM aniimo_del_team WHERE id = :id"), {"id": aniimo_id}
        ).scalar_one()


def _limpiar_usuarios(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM usuario"))


@pytest.mark.parametrize(
    ("antes", "despues"),
    [
        ("dps", "dps"),
        ("soporte", "ayuda"),
        ("sanador", "curacion"),
        ("tanque", None),
        (None, None),
    ],
)
def test_upgrade_convierte_los_roles_existentes(
    base_migrable: Engine, alembic_config: Config, antes: str | None, despues: str | None
) -> None:
    command.downgrade(alembic_config, "003")
    try:
        aniimo_id = _crear_aniimo_con_rol(base_migrable, antes)
        command.upgrade(alembic_config, "head")
        assert _rol_de(base_migrable, aniimo_id) == despues
    finally:
        _limpiar_usuarios(base_migrable)


@pytest.mark.parametrize(
    ("antes", "despues"),
    [
        ("dps", "dps"),
        ("ayuda", "soporte"),
        ("curacion", "sanador"),
        ("regen", None),
        ("break", None),
    ],
)
def test_downgrade_restaura_los_roles_anteriores(
    base_migrable: Engine, alembic_config: Config, antes: str, despues: str | None
) -> None:
    command.upgrade(alembic_config, "head")
    try:
        aniimo_id = _crear_aniimo_con_rol(base_migrable, antes)
        command.downgrade(alembic_config, "003")
        assert _rol_de(base_migrable, aniimo_id) == despues
    finally:
        _limpiar_usuarios(base_migrable)


def test_el_check_de_rol_acepta_el_catalogo_nuevo_y_rechaza_el_viejo(
    base_migrable: Engine,
) -> None:
    for rol in ("dps", "ayuda", "curacion", "regen", "break"):
        _crear_aniimo_con_rol(base_migrable, rol)
    for rol in ("tanque", "soporte", "sanador"):
        with pytest.raises(IntegrityError):
            _crear_aniimo_con_rol(base_migrable, rol)
    _limpiar_usuarios(base_migrable)
    nombres = {c["name"] for c in inspect(base_migrable).get_check_constraints("aniimo_del_team")}
    assert "ck_aniimo_del_team_rol" in nombres


def _crear_aniimo_con_estrella(engine: Engine, estrella: int) -> str:
    with engine.begin() as connection:
        usuario_id = connection.execute(
            text(
                "INSERT INTO usuario (id, nombre_usuario, password_hash) "
                "VALUES (gen_random_uuid(), :nombre, 'x') RETURNING id"
            ),
            {"nombre": f"u{uuid4().hex[:12]}"},
        ).scalar_one()
        team_id = connection.execute(
            text(
                "INSERT INTO team (id, usuario_id, nombre, orden) "
                "VALUES (gen_random_uuid(), :u, 'T', 1) RETURNING id"
            ),
            {"u": usuario_id},
        ).scalar_one()
        return str(
            connection.execute(
                text(
                    "INSERT INTO aniimo_del_team (id, team_id, slot, nombre, estrella_actual) "
                    "VALUES (gen_random_uuid(), :t, 1, 'A', :e) RETURNING id"
                ),
                {"t": team_id, "e": estrella},
            ).scalar_one()
        )


def test_upgrade_head_agrega_fecha_de_parche_y_etapa_de_estrella_nulas(
    base_migrable: Engine,
) -> None:
    columnas = _columnas(base_migrable, "aniimo_del_team")

    assert columnas["fecha_parche"]["nullable"] is True
    assert columnas["etapa_estrella"]["nullable"] is True
    assert columnas["fecha_parche"]["default"] is None
    assert columnas["etapa_estrella"]["default"] is None


def test_los_aniimo_de_005_quedan_con_fecha_y_etapa_vacias_y_estrella_intacta(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.downgrade(alembic_config, "005")
    try:
        aniimo_id = _crear_aniimo_con_estrella(base_migrable, 2)
        command.upgrade(alembic_config, "head")
        with base_migrable.connect() as connection:
            fila = connection.execute(
                text(
                    "SELECT fecha_parche, etapa_estrella, estrella_actual, nombre "
                    "FROM aniimo_del_team WHERE id = :id"
                ),
                {"id": aniimo_id},
            ).one()
        assert tuple(fila) == (None, None, 2, "A")
    finally:
        _limpiar_usuarios(base_migrable)


def test_downgrade_a_005_quita_las_dos_columnas_y_conserva_el_resto(
    base_migrable: Engine, alembic_config: Config
) -> None:
    command.upgrade(alembic_config, "head")
    try:
        aniimo_id = _crear_aniimo_con_estrella(base_migrable, 3)
        command.downgrade(alembic_config, "005")
        columnas = _columnas(base_migrable, "aniimo_del_team")
        assert "fecha_parche" not in columnas
        assert "etapa_estrella" not in columnas
        with base_migrable.connect() as connection:
            estrella = connection.execute(
                text("SELECT estrella_actual FROM aniimo_del_team WHERE id = :id"),
                {"id": aniimo_id},
            ).scalar_one()
        assert estrella == 3
    finally:
        _limpiar_usuarios(base_migrable)


def test_los_check_de_fecha_y_etapa_tienen_el_nombre_de_la_convencion(
    migrated_engine: Engine,
) -> None:
    nombres = {c["name"] for c in inspect(migrated_engine).get_check_constraints("aniimo_del_team")}

    assert "ck_aniimo_del_team_fecha_parche_rango" in nombres
    assert "ck_aniimo_del_team_etapa_estrella_rango" in nombres
