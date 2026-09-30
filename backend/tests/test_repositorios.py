from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.catalogos import PosicionObjeto, Rareza
from app.domain.entidades import (
    AniimoDelTeam,
    ImagenAniimo,
    MaterialEstrella,
    ObjetoTransportado,
    Team,
    Usuario,
)
from app.domain.errores import EntidadNoEncontrada
from app.domain.imagenes import TipoDeImagen
from app.infrastructure.modelos import TeamModelo, UsuarioModelo
from tests.fabricas import (
    persistir_aniimo,
    persistir_sesion,
    persistir_team,
    persistir_usuario,
    sesion_de_prueba,
)
from tests.imagenes_de_prueba import JPEG, PNG, WEBP


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


def test_obtener_sesion_por_token_hash(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    sesion = persistir_sesion(session_factory, sesion_de_prueba(usuario, token_hash="b" * 64))
    persistir_sesion(session_factory, sesion_de_prueba(usuario, token_hash="c" * 64))
    with UnitOfWork(session_factory) as uow:
        assert uow.sesiones.obtener_por_token_hash("b" * 64) == sesion


def test_obtener_sesion_con_hash_inexistente_devuelve_none(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    persistir_sesion(session_factory, sesion_de_prueba(usuario))
    with UnitOfWork(session_factory) as uow:
        assert uow.sesiones.obtener_por_token_hash("z" * 64) is None


def test_borrar_vencidas_de_un_usuario_no_toca_las_vigentes_ni_las_de_otros(
    session_factory: sessionmaker[Session],
) -> None:
    a = persistir_usuario(session_factory, "a")
    b = persistir_usuario(session_factory, "b")
    ahora = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    creada = ahora - timedelta(hours=1)
    vencida_a = sesion_de_prueba(
        a,
        "1" * 64,
        creada,
        expira_en=ahora - timedelta(minutes=1),
        vence_en=ahora + timedelta(hours=1),
    )
    vigente_a = sesion_de_prueba(a, "2" * 64, creada, expira_en=ahora + timedelta(minutes=5))
    vencida_b = sesion_de_prueba(b, "3" * 64, creada, expira_en=ahora - timedelta(minutes=1))
    for sesion in (vencida_a, vigente_a, vencida_b):
        persistir_sesion(session_factory, sesion)
    with UnitOfWork(session_factory) as uow:
        uow.sesiones.borrar_vencidas_de(a.id, ahora)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.sesiones.obtener_por_token_hash("1" * 64) is None
        assert uow.sesiones.obtener_por_token_hash("2" * 64) == vigente_a
        assert uow.sesiones.obtener_por_token_hash("3" * 64) == vencida_b


def test_borrar_vencidas_incluye_las_que_pasaron_el_tope_absoluto(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    ahora = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)
    tope = ahora - timedelta(seconds=1)
    persistir_sesion(
        session_factory,
        sesion_de_prueba(
            usuario, creada_en=ahora - timedelta(hours=12), expira_en=tope, vence_en=tope
        ),
    )
    with UnitOfWork(session_factory) as uow:
        uow.sesiones.borrar_vencidas_de(usuario.id, ahora)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.sesiones.obtener_por_token_hash("a" * 64) is None


def test_team_por_id_restringido_al_duenio(session_factory: sessionmaker[Session]) -> None:
    a = persistir_usuario(session_factory, "a")
    b = persistir_usuario(session_factory, "b")
    team = persistir_team(session_factory, a)
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener_de_usuario(team.id, a.id) == team
        assert uow.teams.obtener_de_usuario(team.id, b.id) is None
        assert uow.teams.obtener_de_usuario(uuid4(), a.id) is None


def test_aniimo_por_slot_ocupado_y_vacio(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    aniimo = AniimoDelTeam(
        team_id=team.id,
        slot=2,
        nombre="Dos",
        materiales=(MaterialEstrella(1, "Polvo", 3, 5),),
        objetos=(ObjetoTransportado(PosicionObjeto.EQUIPADO, "Anillo", Rareza.RARA),),
    )
    persistir_aniimo(session_factory, aniimo)
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.obtener_por_slot(team.id, 2) == aniimo
        assert uow.aniimos.obtener_por_slot(team.id, 4) is None
        assert uow.aniimos.obtener_por_slot(uuid4(), 2) is None


def test_listar_aniimo_de_varios_teams_sin_traer_los_de_otros(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    t1 = persistir_team(session_factory, usuario, orden=1)
    t2 = persistir_team(session_factory, usuario, orden=2)
    t3 = persistir_team(session_factory, usuario, orden=3)
    material = (MaterialEstrella(1, "Polvo", 1, 2),)
    aniimos = [
        AniimoDelTeam(team_id=t1.id, slot=1, nombre="A", materiales=material),
        AniimoDelTeam(team_id=t1.id, slot=3, nombre="B"),
        AniimoDelTeam(
            team_id=t2.id,
            slot=2,
            nombre="C",
            objetos=(ObjetoTransportado(PosicionObjeto.ALTERNATIVO, "Anillo", Rareza.EPICA),),
        ),
        AniimoDelTeam(team_id=t3.id, slot=1, nombre="Ajeno"),
    ]
    for aniimo in aniimos:
        persistir_aniimo(session_factory, aniimo)
    with UnitOfWork(session_factory) as uow:
        obtenidos = uow.aniimos.listar_por_teams([t1.id, t2.id])
        assert sorted(obtenidos, key=lambda a: a.nombre) == aniimos[:3]
        assert uow.aniimos.listar_por_teams([]) == []


def _aniimo_persistido(session_factory: sessionmaker[Session]) -> AniimoDelTeam:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    aniimo = AniimoDelTeam(team_id=team.id, slot=1, nombre="Irisalis")
    persistir_aniimo(session_factory, aniimo)
    return aniimo


def test_imagen_round_trip_y_reemplazo(session_factory: sessionmaker[Session]) -> None:
    aniimo = _aniimo_persistido(session_factory)
    primera = ImagenAniimo(aniimo.id, TipoDeImagen.PNG, PNG)
    with UnitOfWork(session_factory) as uow:
        assert uow.imagenes.obtener(aniimo.id) is None
        uow.imagenes.guardar(primera)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.imagenes.obtener(aniimo.id) == primera
    segunda = ImagenAniimo(aniimo.id, TipoDeImagen.WEBP, WEBP)
    with UnitOfWork(session_factory) as uow:
        uow.imagenes.guardar(segunda)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.imagenes.obtener(aniimo.id) == segunda


def test_borrar_imagen_es_idempotente(session_factory: sessionmaker[Session]) -> None:
    aniimo = _aniimo_persistido(session_factory)
    with UnitOfWork(session_factory) as uow:
        uow.imagenes.guardar(ImagenAniimo(aniimo.id, TipoDeImagen.JPEG, JPEG))
        uow.commit()
    for _ in range(2):
        with UnitOfWork(session_factory) as uow:
            uow.imagenes.borrar(aniimo.id)
            uow.commit()
        with UnitOfWork(session_factory) as uow:
            assert uow.imagenes.obtener(aniimo.id) is None
            assert uow.aniimos.obtener(aniimo.id) == aniimo


def test_ids_con_imagen_devuelve_solo_los_que_tienen(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    aniimos = [AniimoDelTeam(team_id=team.id, slot=n, nombre=f"A{n}") for n in (1, 2, 3)]
    for aniimo in aniimos:
        persistir_aniimo(session_factory, aniimo)
    with UnitOfWork(session_factory) as uow:
        for aniimo in (aniimos[0], aniimos[2]):
            uow.imagenes.guardar(ImagenAniimo(aniimo.id, TipoDeImagen.PNG, PNG))
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        todos = [a.id for a in aniimos]
        assert uow.imagenes.ids_con_imagen(todos) == {aniimos[0].id, aniimos[2].id}
        assert uow.imagenes.ids_con_imagen([]) == set()
        assert uow.imagenes.ids_con_imagen([aniimos[1].id, uuid4()]) == set()
