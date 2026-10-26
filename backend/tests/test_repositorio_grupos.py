from dataclasses import replace

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import GrupoDeTeams, Team, Usuario
from app.domain.errores import EntidadNoEncontrada, PosicionDeGrupoOcupada
from tests.fabricas import persistir_grupo, persistir_team, persistir_usuario


@pytest.fixture
def usuario(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "axel")


@pytest.fixture
def otro(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "otro")


def test_el_grupo_se_guarda_y_se_lee_igual(
    session_factory: sessionmaker[Session], usuario: Usuario
) -> None:
    grupo = persistir_grupo(session_factory, usuario, orden=2, nombre="Homeland")
    with UnitOfWork(session_factory) as uow:
        assert uow.grupos.obtener(grupo.id) == grupo


def test_listar_por_usuario_ordena_por_orden_y_no_trae_ajenos(
    session_factory: sessionmaker[Session], usuario: Usuario, otro: Usuario
) -> None:
    tercero = persistir_grupo(session_factory, usuario, orden=3)
    primero = persistir_grupo(session_factory, usuario, orden=1)
    persistir_grupo(session_factory, otro, orden=2)
    with UnitOfWork(session_factory) as uow:
        assert uow.grupos.listar_por_usuario(usuario.id) == [primero, tercero]
        assert uow.grupos.listar_por_usuario_con_bloqueo(usuario.id) == [primero, tercero]


def test_obtener_de_usuario_no_devuelve_el_grupo_de_otro(
    session_factory: sessionmaker[Session], usuario: Usuario, otro: Usuario
) -> None:
    grupo = persistir_grupo(session_factory, usuario)
    with UnitOfWork(session_factory) as uow:
        assert uow.grupos.obtener_de_usuario(grupo.id, usuario.id) == grupo
        assert uow.grupos.obtener_de_usuario(grupo.id, otro.id) is None
        assert uow.grupos.obtener_de_usuario_con_bloqueo(grupo.id, usuario.id) == grupo
        assert uow.grupos.obtener_de_usuario_con_bloqueo(grupo.id, otro.id) is None


def test_actualizar_grupo_cambia_nombre_y_portada(
    session_factory: sessionmaker[Session], usuario: Usuario
) -> None:
    grupo = persistir_grupo(session_factory, usuario)
    team = persistir_team(session_factory, usuario)
    cambiado = replace(grupo, nombre="Nuevo", portada_team_id=team.id)
    with UnitOfWork(session_factory) as uow:
        uow.grupos.actualizar(cambiado)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.grupos.obtener(grupo.id) == cambiado


def test_actualizar_un_grupo_inexistente_falla(
    session_factory: sessionmaker[Session], usuario: Usuario
) -> None:
    with UnitOfWork(session_factory) as uow, pytest.raises(EntidadNoEncontrada):
        uow.grupos.actualizar(GrupoDeTeams(usuario_id=usuario.id, nombre="X", orden=1))


def test_el_orden_de_grupo_repetido_se_traduce_a_posicion_ocupada(
    session_factory: sessionmaker[Session], usuario: Usuario
) -> None:
    persistir_grupo(session_factory, usuario, orden=2)
    with UnitOfWork(session_factory) as uow:
        uow.grupos.agregar(GrupoDeTeams(usuario_id=usuario.id, nombre="Otro", orden=2))
        with pytest.raises(PosicionDeGrupoOcupada):
            uow.commit()


def test_el_team_conserva_grupo_y_portada_al_guardarse(
    session_factory: sessionmaker[Session], usuario: Usuario
) -> None:
    grupo = persistir_grupo(session_factory, usuario)
    team = Team(usuario_id=usuario.id, nombre="Raid", orden=1, grupo_id=grupo.id, portada_slot=3)
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(team)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener(team.id) == team


def test_listar_teams_por_grupo_y_sueltos_con_bloqueo(
    session_factory: sessionmaker[Session], usuario: Usuario, otro: Usuario
) -> None:
    grupo = persistir_grupo(session_factory, usuario)
    en_grupo = [
        Team(usuario_id=usuario.id, nombre=f"G{orden}", orden=orden, grupo_id=grupo.id)
        for orden in (4, 2)
    ]
    sueltos = [Team(usuario_id=usuario.id, nombre=f"S{orden}", orden=orden) for orden in (3, 1)]
    ajeno = Team(usuario_id=otro.id, nombre="Ajeno", orden=1)
    with UnitOfWork(session_factory) as uow:
        for team in [*en_grupo, *sueltos, ajeno]:
            uow.teams.agregar(team)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert [t.orden for t in uow.teams.listar_por_grupo(grupo.id)] == [2, 4]
        assert [t.orden for t in uow.teams.listar_por_grupo_con_bloqueo(grupo.id)] == [2, 4]
        assert [t.orden for t in uow.teams.listar_sueltos_con_bloqueo(usuario.id)] == [1, 3]
