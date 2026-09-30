import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import AniimoDelTeam, Team, Usuario
from app.infrastructure.database import make_session_factory
from tests.fabricas import persistir_team, persistir_usuario


def test_commit_explicito_persiste(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    team = Team(usuario_id=usuario.id, nombre="Team", orden=1)
    aniimos = [
        AniimoDelTeam(team_id=team.id, slot=1, nombre="Uno"),
        AniimoDelTeam(team_id=team.id, slot=2, nombre="Dos"),
    ]
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(team)
        for aniimo in aniimos:
            uow.aniimos.agregar(aniimo)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener(team.id) == team
        assert uow.aniimos.listar_por_team(team.id) == aniimos


def test_salir_sin_commit_no_persiste(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    team = Team(usuario_id=usuario.id, nombre="Team", orden=1)
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(team)
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener(team.id) is None


def test_una_excepcion_dentro_del_bloque_revierte(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    team = Team(usuario_id=usuario.id, nombre="Team", orden=1)
    with pytest.raises(RuntimeError), UnitOfWork(session_factory) as uow:
        uow.teams.agregar(team)
        uow.commit()
        uow.teams.agregar(Team(usuario_id=usuario.id, nombre="Otro", orden=2))
        raise RuntimeError("falla a mitad del bloque")
    with UnitOfWork(session_factory) as uow:
        assert [t.orden for t in uow.teams.listar_por_usuario(usuario.id)] == [1]


def test_lo_no_confirmado_se_pierde_aunque_haya_un_commit_previo(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(Team(usuario_id=usuario.id, nombre="Confirmado", orden=1))
        uow.commit()
        uow.teams.agregar(Team(usuario_id=usuario.id, nombre="Sin confirmar", orden=2))
    with UnitOfWork(session_factory) as uow:
        assert [t.nombre for t in uow.teams.listar_por_usuario(usuario.id)] == ["Confirmado"]


def test_la_sesion_se_cierra_al_salir(session_factory: sessionmaker[Session]) -> None:
    with UnitOfWork(session_factory) as uow:
        sesion = uow.session
        assert sesion.is_active
    assert not sesion.in_transaction()


def test_commit_real_sobre_conexion_propia(migrated_engine: Engine, test_database_url: str) -> None:
    engine = create_engine(test_database_url)
    factory = make_session_factory(engine)
    usuario = Usuario("uow_commit_real", "hash")
    try:
        with UnitOfWork(factory) as uow:
            uow.usuarios.agregar(usuario)
            uow.commit()
        with UnitOfWork(factory) as uow:
            assert uow.usuarios.obtener(usuario.id) == usuario
    finally:
        with engine.begin() as connection:
            connection.execute(
                text("DELETE FROM usuario WHERE nombre_usuario = :n"), {"n": "uow_commit_real"}
            )
        engine.dispose()


def test_persistir_team_ayudante_devuelve_lo_guardado(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario, orden=2)
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener(team.id) == team
