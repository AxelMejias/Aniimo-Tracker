import dataclasses

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.catalogos import PosicionObjeto, Rareza
from app.domain.entidades import (
    AniimoDelTeam,
    MaterialEstrella,
    ObjetoTransportado,
    Team,
    Usuario,
)
from app.domain.errores import NombreUsuarioDuplicado, PosicionDeTeamOcupada, SlotOcupado
from app.infrastructure.modelos import MaterialEstrellaModelo, ObjetoTransportadoModelo
from tests.fabricas import persistir_aniimo, persistir_team, persistir_usuario


def _contar(session_factory: sessionmaker[Session], modelo: type) -> int:
    with session_factory() as session:
        return session.scalar(select(func.count()).select_from(modelo)) or 0


@pytest.mark.parametrize("segundo", ["axel", "AXEL", "Axel"])
def test_nombre_de_usuario_repetido_se_rechaza(
    session_factory: sessionmaker[Session], segundo: str
) -> None:
    persistir_usuario(session_factory, "axel")
    repetido = Usuario(segundo, "otro-hash")
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.agregar(repetido)
        with pytest.raises(NombreUsuarioDuplicado):
            uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(repetido.id) is None
        assert [u.nombre_usuario for u in uow.usuarios.listar()].count("axel") == 1


def test_cuatro_teams_se_persisten_ordenados(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    teams = [Team(usuario_id=usuario.id, nombre=f"T{orden}", orden=orden) for orden in (3, 1, 4, 2)]
    with UnitOfWork(session_factory) as uow:
        for team in teams:
            uow.teams.agregar(team)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert [t.orden for t in uow.teams.listar_por_usuario(usuario.id)] == [1, 2, 3, 4]


def test_orden_de_team_repetido_del_mismo_usuario_se_rechaza(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    persistir_team(session_factory, usuario, orden=2)
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(Team(usuario_id=usuario.id, nombre="Repetido", orden=2))
        with pytest.raises(PosicionDeTeamOcupada):
            uow.commit()


def test_mismo_orden_en_usuarios_distintos_se_permite(
    session_factory: sessionmaker[Session],
) -> None:
    a = persistir_usuario(session_factory, "a")
    b = persistir_usuario(session_factory, "b")
    persistir_team(session_factory, a, orden=1)
    persistir_team(session_factory, b, orden=1)
    with UnitOfWork(session_factory) as uow:
        assert len(uow.teams.listar_por_usuario(a.id)) == 1
        assert len(uow.teams.listar_por_usuario(b.id)) == 1


def test_slot_ocupado_se_rechaza_y_el_original_no_cambia(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    original = AniimoDelTeam(team_id=team.id, slot=1, nombre="Original", nivel=10)
    persistir_aniimo(session_factory, original)
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.agregar(AniimoDelTeam(team_id=team.id, slot=1, nombre="Intruso"))
        with pytest.raises(SlotOcupado):
            uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.listar_por_team(team.id) == [original]


def test_mismo_slot_en_teams_distintos_se_permite(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    uno = persistir_team(session_factory, usuario, orden=1)
    dos = persistir_team(session_factory, usuario, orden=2)
    persistir_aniimo(session_factory, AniimoDelTeam(team_id=uno.id, slot=1, nombre="A"))
    persistir_aniimo(session_factory, AniimoDelTeam(team_id=dos.id, slot=1, nombre="B"))
    with UnitOfWork(session_factory) as uow:
        assert len(uow.aniimos.listar_por_team(uno.id)) == 1
        assert len(uow.aniimos.listar_por_team(dos.id)) == 1


def test_slot_liberado_se_puede_volver_a_cargar(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    viejo = AniimoDelTeam(team_id=team.id, slot=2, nombre="Viejo")
    persistir_aniimo(session_factory, viejo)
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.borrar(viejo.id)
        uow.commit()
    nuevo = AniimoDelTeam(team_id=team.id, slot=2, nombre="Nuevo")
    persistir_aniimo(session_factory, nuevo)
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.listar_por_team(team.id) == [nuevo]


def test_reemplazar_el_aniimo_de_un_slot_en_una_sola_uow(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    viejo = AniimoDelTeam(team_id=team.id, slot=2, nombre="Viejo")
    persistir_aniimo(session_factory, viejo)
    nuevo = AniimoDelTeam(team_id=team.id, slot=2, nombre="Nuevo")
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.borrar(viejo.id)
        uow.session.flush()
        uow.aniimos.agregar(nuevo)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.listar_por_team(team.id) == [nuevo]


def test_operacion_compuesta_con_slot_repetido_no_deja_nada(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = Team(usuario_id=usuario.id, nombre="Nuevo", orden=1)
    primero = AniimoDelTeam(team_id=team.id, slot=1, nombre="Uno")
    repetido = AniimoDelTeam(team_id=team.id, slot=1, nombre="Repetido")
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(team)
        uow.aniimos.agregar(primero)
        uow.aniimos.agregar(repetido)
        with pytest.raises(SlotOcupado):
            uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener(team.id) is None
        assert uow.aniimos.obtener(primero.id) is None
        assert uow.aniimos.obtener(repetido.id) is None


def _aniimo_con_hijos(team_id: object, slot: int, nombre: str) -> AniimoDelTeam:
    return AniimoDelTeam(
        team_id=team_id,  # type: ignore[arg-type]
        slot=slot,
        nombre=nombre,
        materiales=tuple(MaterialEstrella(posicion=i, nombre=f"M{i}") for i in (1, 2, 3)),
        objetos=(
            ObjetoTransportado(posicion=PosicionObjeto.EQUIPADO, nombre="O1", rareza=Rareza.RARA),
            ObjetoTransportado(
                posicion=PosicionObjeto.ALTERNATIVO, nombre="O2", rareza=Rareza.EPICA
            ),
        ),
    )


def test_borrar_un_aniimo_borra_sus_hijos_y_no_toca_al_resto(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    a_borrar = _aniimo_con_hijos(team.id, 1, "Borrar")
    vecino = _aniimo_con_hijos(team.id, 2, "Vecino")
    persistir_aniimo(session_factory, a_borrar)
    persistir_aniimo(session_factory, vecino)
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.borrar(a_borrar.id)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.listar_por_team(team.id) == [vecino]
    assert _contar(session_factory, MaterialEstrellaModelo) == 3
    assert _contar(session_factory, ObjetoTransportadoModelo) == 2


def test_borrar_un_team_borra_sus_aniimos_e_hijos_sin_tocar_otros_teams(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario, orden=1)
    otro = persistir_team(session_factory, usuario, orden=2)
    for slot in (1, 2, 3, 4):
        persistir_aniimo(session_factory, _aniimo_con_hijos(team.id, slot, f"T{slot}"))
    sobreviviente = _aniimo_con_hijos(otro.id, 1, "Sobrevive")
    persistir_aniimo(session_factory, sobreviviente)
    with UnitOfWork(session_factory) as uow:
        uow.teams.borrar(team.id)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.listar_por_team(team.id) == []
        assert uow.teams.listar_por_usuario(usuario.id) == [otro]
        assert uow.aniimos.listar_por_team(otro.id) == [sobreviviente]
    assert _contar(session_factory, MaterialEstrellaModelo) == 3
    assert _contar(session_factory, ObjetoTransportadoModelo) == 2


def test_borrar_un_usuario_borra_sus_teams_y_no_toca_a_otros(
    session_factory: sessionmaker[Session],
) -> None:
    a = persistir_usuario(session_factory, "a")
    b = persistir_usuario(session_factory, "b")
    team_a = persistir_team(session_factory, a)
    team_b = persistir_team(session_factory, b)
    persistir_aniimo(session_factory, _aniimo_con_hijos(team_a.id, 1, "De A"))
    de_b = _aniimo_con_hijos(team_b.id, 1, "De B")
    persistir_aniimo(session_factory, de_b)
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.borrar(a.id)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(a.id) is None
        assert uow.teams.listar_por_usuario(a.id) == []
        assert uow.teams.listar_por_usuario(b.id) == [team_b]
        assert uow.aniimos.listar_por_team(team_b.id) == [de_b]
    assert _contar(session_factory, MaterialEstrellaModelo) == 3


def test_borrar_con_las_filas_ya_cargadas_en_la_misma_uow(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    aniimo = _aniimo_con_hijos(team.id, 1, "Cargado")
    persistir_aniimo(session_factory, aniimo)
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.listar_por_team(team.id) == [aniimo]
        uow.teams.borrar(team.id)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.obtener(aniimo.id) is None
    assert _contar(session_factory, MaterialEstrellaModelo) == 0


def test_actualizar_el_slot_a_uno_ocupado_se_rechaza(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    uno = AniimoDelTeam(team_id=team.id, slot=1, nombre="Uno")
    dos = AniimoDelTeam(team_id=team.id, slot=2, nombre="Dos")
    persistir_aniimo(session_factory, uno)
    persistir_aniimo(session_factory, dos)
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.actualizar(dataclasses.replace(dos, slot=1))
        with pytest.raises(SlotOcupado):
            uow.commit()
