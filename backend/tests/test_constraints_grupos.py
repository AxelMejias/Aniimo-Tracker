from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.infrastructure.modelos import GrupoDeTeamsModelo, TeamModelo, UsuarioModelo


@dataclass(frozen=True)
class Duenios:
    a_id: UUID
    team_a_id: UUID
    b_id: UUID
    team_b_id: UUID


@pytest.fixture
def session(session_factory: sessionmaker[Session]) -> Session:
    with session_factory() as sesion:
        yield sesion  # type: ignore[misc]


@pytest.fixture
def duenios(session: Session) -> Duenios:
    ids: list[UUID] = []
    for nombre in ("usuario_a", "usuario_b"):
        usuario = UsuarioModelo(id=uuid4(), nombre_usuario=nombre, password_hash="hash")
        session.add(usuario)
        session.flush()
        team = TeamModelo(id=uuid4(), usuario_id=usuario.id, nombre="Team", orden=1)
        session.add(team)
        session.flush()
        ids.extend([usuario.id, team.id])
    return Duenios(*ids)


def _grupo(usuario_id: UUID, **campos: object) -> GrupoDeTeamsModelo:
    base: dict[str, object] = {
        "id": uuid4(),
        "usuario_id": usuario_id,
        "nombre": "Buildeado",
        "orden": 1,
    }
    return GrupoDeTeamsModelo(**{**base, **campos})


def _nombre_del_constraint(error: IntegrityError) -> str:
    return error.orig.diag.constraint_name  # type: ignore[union-attr]


def _team(duenios: Duenios, **campos: object) -> TeamModelo:
    base: dict[str, object] = {
        "id": uuid4(),
        "usuario_id": duenios.a_id,
        "nombre": "Otro",
        "orden": 2,
    }
    return TeamModelo(**{**base, **campos})


CASOS_INVALIDOS: list[tuple[str, Callable[[Duenios], Any], str]] = [
    ("team_orden_21", lambda d: _team(d, orden=21), "ck_team_orden_rango"),
    ("team_orden_0", lambda d: _team(d, orden=0), "ck_team_orden_rango"),
    ("team_portada_slot_5", lambda d: _team(d, portada_slot=5), "ck_team_portada_slot_rango"),
    ("team_portada_slot_0", lambda d: _team(d, portada_slot=0), "ck_team_portada_slot_rango"),
    ("grupo_orden_5", lambda d: _grupo(d.a_id, orden=5), "ck_grupo_de_teams_orden_rango"),
    ("grupo_orden_0", lambda d: _grupo(d.a_id, orden=0), "ck_grupo_de_teams_orden_rango"),
    (
        "grupo_nombre_vacio",
        lambda d: _grupo(d.a_id, nombre=""),
        "ck_grupo_de_teams_nombre_no_vacio",
    ),
    (
        "portada_de_un_team_de_otro_usuario",
        lambda d: _grupo(d.a_id, portada_team_id=d.team_b_id),
        "fk_grupo_de_teams_usuario_id_team",
    ),
]


@pytest.mark.parametrize(
    ("construir", "constraint"),
    [pytest.param(c, n, id=i) for i, c, n in CASOS_INVALIDOS],
)
def test_la_base_rechaza_filas_invalidas_de_teams_y_grupos(
    session: Session, duenios: Duenios, construir: Callable[[Duenios], Any], constraint: str
) -> None:
    session.add(construir(duenios))
    with pytest.raises(IntegrityError) as info:
        session.flush()
    assert _nombre_del_constraint(info.value) == constraint


def test_la_base_rechaza_un_team_en_el_grupo_de_otro_usuario(
    session: Session, duenios: Duenios
) -> None:
    grupo_de_b = _grupo(duenios.b_id)
    session.add(grupo_de_b)
    session.flush()
    session.add(_team(duenios, grupo_id=grupo_de_b.id))
    with pytest.raises(IntegrityError) as info:
        session.flush()
    assert _nombre_del_constraint(info.value) == "fk_team_usuario_id_grupo_de_teams"


def test_la_base_acepta_el_team_vigesimo_y_un_grupo_con_portada_propia(
    session: Session, duenios: Duenios
) -> None:
    session.add(_team(duenios, orden=20, portada_slot=4))
    session.add(_grupo(duenios.a_id, orden=4, portada_team_id=duenios.team_a_id))
    session.flush()


def test_dos_teams_con_el_mismo_orden_siguen_rechazados(session: Session, duenios: Duenios) -> None:
    session.add(_team(duenios, orden=1))
    with pytest.raises(IntegrityError) as info:
        session.flush()
    assert _nombre_del_constraint(info.value) == "uq_team_usuario_id_orden"


def test_dos_grupos_con_el_mismo_orden_siguen_rechazados(
    session: Session, duenios: Duenios
) -> None:
    session.add(_grupo(duenios.a_id, orden=2))
    session.flush()
    session.add(_grupo(duenios.a_id, orden=2, nombre="Otro"))
    with pytest.raises(IntegrityError) as info:
        session.flush()
    assert _nombre_del_constraint(info.value) == "uq_grupo_de_teams_usuario_id_orden"


@pytest.mark.parametrize(
    "restriccion", ["uq_team_usuario_id_orden", "uq_grupo_de_teams_usuario_id_orden"]
)
def test_diferida_la_unicidad_se_verifica_al_pasar_a_inmediata(
    session: Session, duenios: Duenios, restriccion: str
) -> None:
    if restriccion == "uq_team_usuario_id_orden":
        repetido: Any = _team(duenios, orden=1)
    else:
        session.add(_grupo(duenios.a_id, orden=2))
        session.flush()
        repetido = _grupo(duenios.a_id, orden=2, nombre="Otro")
    session.execute(text(f"SET CONSTRAINTS {restriccion} DEFERRED"))
    session.add(repetido)
    session.flush()
    with pytest.raises(IntegrityError) as info:
        session.execute(text(f"SET CONSTRAINTS {restriccion} IMMEDIATE"))
    assert _nombre_del_constraint(info.value) == restriccion


def test_borrar_el_grupo_deja_sus_teams_sueltos_y_vivos(session: Session, duenios: Duenios) -> None:
    grupo = _grupo(duenios.a_id)
    session.add(grupo)
    session.flush()
    team = _team(duenios, grupo_id=grupo.id)
    session.add(team)
    session.flush()
    session.execute(delete(GrupoDeTeamsModelo).where(GrupoDeTeamsModelo.id == grupo.id))
    session.expire_all()
    assert session.get(TeamModelo, team.id).grupo_id is None  # type: ignore[union-attr]
    assert session.get(TeamModelo, team.id).usuario_id == duenios.a_id  # type: ignore[union-attr]


def test_borrar_el_team_de_portada_deja_el_grupo_sin_portada_elegida(
    session: Session, duenios: Duenios
) -> None:
    grupo = _grupo(duenios.a_id, portada_team_id=duenios.team_a_id)
    session.add(grupo)
    session.flush()
    session.execute(delete(TeamModelo).where(TeamModelo.id == duenios.team_a_id))
    session.expire_all()
    fila = session.get(GrupoDeTeamsModelo, grupo.id)
    assert fila is not None
    assert fila.portada_team_id is None


def test_borrar_el_usuario_borra_sus_grupos_y_no_los_ajenos(
    session: Session, duenios: Duenios
) -> None:
    session.add(_grupo(duenios.a_id))
    session.add(_grupo(duenios.b_id))
    session.flush()
    session.execute(delete(UsuarioModelo).where(UsuarioModelo.id == duenios.a_id))
    cuantos = session.scalar(
        select(func.count())
        .select_from(GrupoDeTeamsModelo)
        .where(GrupoDeTeamsModelo.usuario_id == duenios.a_id)
    )
    restantes = session.scalar(select(func.count()).select_from(GrupoDeTeamsModelo))
    assert (cuantos, restantes) == (0, 1)
