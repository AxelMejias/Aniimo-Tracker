from uuid import uuid4

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import AniimoDelTeam, MaterialEstrella, Team, Usuario
from app.domain.errores import EntidadNoEncontrada
from app.infrastructure.modelos import TeamModelo, UsuarioModelo
from tests.fabricas import persistir_aniimo, persistir_team, persistir_usuario


def test_los_repositorios_devuelven_entidades_de_dominio(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    aniimo = AniimoDelTeam(team_id=team.id, slot=1, nombre="A")
    persistir_aniimo(session_factory, aniimo)
    with UnitOfWork(session_factory) as uow:
        assert type(uow.usuarios.obtener(usuario.id)) is Usuario
        assert type(uow.teams.obtener(team.id)) is Team
        assert type(uow.aniimos.obtener(aniimo.id)) is AniimoDelTeam
        assert all(type(u) is Usuario for u in uow.usuarios.listar())
        assert not isinstance(uow.teams.listar()[0], TeamModelo)
        assert not isinstance(uow.usuarios.listar()[0], UsuarioModelo)


def test_obtener_por_id_inexistente_devuelve_none(session_factory: sessionmaker[Session]) -> None:
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(uuid4()) is None
        assert uow.teams.obtener(uuid4()) is None
        assert uow.aniimos.obtener(uuid4()) is None


def test_listar_devuelve_todo_lo_guardado(session_factory: sessionmaker[Session]) -> None:
    uno = persistir_usuario(session_factory, "uno")
    dos = persistir_usuario(session_factory, "dos")
    with UnitOfWork(session_factory) as uow:
        assert {u.id for u in uow.usuarios.listar()} >= {uno.id, dos.id}


def test_borrar_por_id_elimina_la_entidad(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    with UnitOfWork(session_factory) as uow:
        uow.teams.borrar(team.id)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener(team.id) is None
        assert uow.usuarios.obtener(usuario.id) == usuario


def test_borrar_un_id_inexistente_no_falla(session_factory: sessionmaker[Session]) -> None:
    with UnitOfWork(session_factory) as uow:
        uow.teams.borrar(uuid4())
        uow.commit()


def test_actualizar_una_entidad_inexistente_falla(session_factory: sessionmaker[Session]) -> None:
    with UnitOfWork(session_factory) as uow, pytest.raises(EntidadNoEncontrada):
        uow.teams.actualizar(Team(usuario_id=uuid4(), nombre="Fantasma", orden=1))


@pytest.mark.parametrize("busqueda", ["axel", "Axel", "AXEL"])
def test_buscar_usuario_ignora_mayusculas(
    session_factory: sessionmaker[Session], busqueda: str
) -> None:
    usuario = persistir_usuario(session_factory, "axel")
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener_por_nombre_usuario(busqueda) == usuario


def test_buscar_usuario_inexistente_devuelve_none(session_factory: sessionmaker[Session]) -> None:
    persistir_usuario(session_factory, "axel")
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener_por_nombre_usuario("nadie") is None


def test_listar_teams_por_usuario_solo_devuelve_los_del_dueno(
    session_factory: sessionmaker[Session],
) -> None:
    a = persistir_usuario(session_factory, "a")
    b = persistir_usuario(session_factory, "b")
    a2 = persistir_team(session_factory, a, orden=2)
    a1 = persistir_team(session_factory, a, orden=1)
    persistir_team(session_factory, b, orden=1)
    persistir_team(session_factory, b, orden=2)
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.listar_por_usuario(a.id) == [a1, a2]
        assert len(uow.teams.listar_por_usuario(b.id)) == 2


def test_listar_aniimos_por_team_ordena_por_slot_y_trae_hijos(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    otro_team = persistir_team(session_factory, usuario, orden=2)
    slot3 = AniimoDelTeam(
        team_id=team.id,
        slot=3,
        nombre="Tres",
        materiales=(MaterialEstrella(posicion=1, nombre="Polvo", tengo=1, necesito=2),),
    )
    slot1 = AniimoDelTeam(team_id=team.id, slot=1, nombre="Uno")
    ajeno = AniimoDelTeam(team_id=otro_team.id, slot=1, nombre="Ajeno")
    for aniimo in (slot3, slot1, ajeno):
        persistir_aniimo(session_factory, aniimo)
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.listar_por_team(team.id) == [slot1, slot3]
        assert uow.aniimos.listar_por_team(otro_team.id) == [ajeno]
