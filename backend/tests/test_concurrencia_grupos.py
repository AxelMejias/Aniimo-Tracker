import time
from collections.abc import Callable, Iterator
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.grupos import ServicioDeGrupos
from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import GrupoDeTeams, Team, Usuario
from app.domain.errores import GrupoLleno, OrdenDesactualizado
from app.infrastructure.database import make_session_factory

ESPERA_A_QUE_BLOQUEEN = 0.7


@dataclass
class Escenario:
    fabrica: sessionmaker[Session]
    servicio: ServicioDeGrupos
    usuario: Usuario
    grupo: GrupoDeTeams


@pytest.fixture
def fabrica_real(migrated_engine: Engine) -> Iterator[sessionmaker[Session]]:
    # Estas pruebas necesitan transacciones reales que se confirmen entre sesiones distintas.
    yield make_session_factory(migrated_engine)
    with migrated_engine.begin() as connection:
        connection.execute(text("DELETE FROM usuario"))


@pytest.fixture
def escenario(fabrica_real: sessionmaker[Session]) -> Escenario:
    usuario = Usuario("concurrente", "hash")
    grupo = GrupoDeTeams(usuario_id=usuario.id, nombre="Buildeado", orden=1)
    with UnitOfWork(fabrica_real) as uow:
        uow.usuarios.agregar(usuario)
        uow.commit()
        uow.grupos.agregar(grupo)
        uow.commit()
    return Escenario(fabrica_real, ServicioDeGrupos(fabrica_real), usuario, grupo)


def _teams(escenario: Escenario, cuantos: int, *, en_grupo: bool, desde: int = 1) -> list[Team]:
    grupo_id = escenario.grupo.id if en_grupo else None
    teams = [
        Team(
            usuario_id=escenario.usuario.id,
            nombre=f"T{orden}",
            orden=orden,
            grupo_id=grupo_id,
        )
        for orden in range(desde, desde + cuantos)
    ]
    with UnitOfWork(escenario.fabrica) as uow:
        for team in teams:
            uow.teams.agregar(team)
        uow.commit()
    return teams


def _resultado(futuro: Future[Any]) -> object:
    try:
        futuro.result(timeout=10)
    except Exception as error:  # noqa: BLE001
        return type(error)
    return "ok"


def _con_el_grupo_bloqueado(
    escenario: Escenario, lanzar: list[Callable[[], Any]]
) -> list[Future[Any]]:
    """Retiene el candado del grupo, lanza cada tarea en orden y las libera juntas."""
    with ThreadPoolExecutor(max_workers=len(lanzar)) as pool, UnitOfWork(escenario.fabrica) as uow:
        assert uow.grupos.obtener_de_usuario_con_bloqueo(escenario.grupo.id, escenario.usuario.id)
        futuros: list[Future[Any]] = []
        for tarea in lanzar:
            futuros.append(pool.submit(tarea))
            time.sleep(ESPERA_A_QUE_BLOQUEEN)
        assert not any(f.done() for f in futuros), "las tareas no esperaron el candado del grupo"
        uow.session.rollback()
    return futuros


def test_dos_pedidos_a_la_vez_a_un_grupo_con_4_teams_dejan_5_y_rechazan_uno(
    escenario: Escenario,
) -> None:
    _teams(escenario, 4, en_grupo=True)
    entrantes = _teams(escenario, 2, en_grupo=False, desde=5)
    futuros = _con_el_grupo_bloqueado(
        escenario,
        [
            lambda t=team: escenario.servicio.agregar_team(  # type: ignore[misc]
                escenario.usuario.id, escenario.grupo.id, t.id
            )
            for team in entrantes
        ],
    )
    resultados = sorted(str(_resultado(f)) for f in futuros)
    assert resultados == sorted(["ok", str(GrupoLleno)])
    with UnitOfWork(escenario.fabrica) as uow:
        assert len(uow.teams.listar_por_grupo(escenario.grupo.id)) == 5


def _reordenar_y_agregar(
    escenario: Escenario, primero: str
) -> tuple[list[Team], Team, dict[str, object]]:
    en_grupo = _teams(escenario, 3, en_grupo=True)
    [entrante] = _teams(escenario, 1, en_grupo=False, desde=4)
    pedido = [en_grupo[2].id, en_grupo[0].id, en_grupo[1].id]

    def reordenar() -> object:
        return escenario.servicio.ordenar_teams_del_grupo(
            escenario.usuario.id, escenario.grupo.id, pedido
        )

    def agregar() -> object:
        return escenario.servicio.agregar_team(
            escenario.usuario.id, escenario.grupo.id, entrante.id
        )

    tareas = {"reordenar": reordenar, "agregar": agregar}
    nombres = [primero, "agregar" if primero == "reordenar" else "reordenar"]
    futuros = _con_el_grupo_bloqueado(escenario, [tareas[n] for n in nombres])
    return en_grupo, entrante, {n: _resultado(f) for n, f in zip(nombres, futuros, strict=True)}


def _ordenes_finales(escenario: Escenario) -> dict[UUID, int]:
    with UnitOfWork(escenario.fabrica) as uow:
        return {t.id: t.orden for t in uow.teams.listar_por_grupo(escenario.grupo.id)}


def test_reordenar_antes_de_que_llegue_otro_team_termina_bien_los_dos(
    escenario: Escenario,
) -> None:
    en_grupo, entrante, resultados = _reordenar_y_agregar(escenario, primero="reordenar")
    assert resultados == {"reordenar": "ok", "agregar": "ok"}
    ordenes = _ordenes_finales(escenario)
    assert len(ordenes) == 4
    assert len(set(ordenes.values())) == 4
    assert ordenes[en_grupo[2].id] < ordenes[en_grupo[0].id] < ordenes[en_grupo[1].id]
    assert entrante.id in ordenes


def test_reordenar_con_una_lista_vieja_tras_agregar_un_team_responde_desactualizado(
    escenario: Escenario,
) -> None:
    en_grupo, entrante, resultados = _reordenar_y_agregar(escenario, primero="agregar")
    assert resultados == {"agregar": "ok", "reordenar": OrdenDesactualizado}
    ordenes = _ordenes_finales(escenario)
    assert ordenes == {**{t.id: t.orden for t in en_grupo}, entrante.id: entrante.orden}
