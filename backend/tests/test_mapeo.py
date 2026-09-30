import dataclasses

from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.catalogos import Elemento, PosicionObjeto, Rareza, Rol, Stat
from app.domain.entidades import (
    AniimoDelTeam,
    MaterialEstrella,
    ObjetoTransportado,
    Team,
    Usuario,
    ValoresDeStat,
)
from tests.fabricas import persistir_team, persistir_usuario


def test_round_trip_de_usuario(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory, "Axel")
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(usuario.id) == usuario


def test_round_trip_de_team(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    team = Team(usuario_id=usuario.id, nombre="Equipo principal", orden=3)
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(team)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.teams.obtener(team.id) == team


def test_round_trip_de_irisalis_completa(
    session_factory: sessionmaker[Session], irisalis: AniimoDelTeam
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    guardado = dataclasses.replace(
        irisalis, team_id=team.id, elemento=Elemento.HIELO, rol=Rol.SANADOR
    )
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.agregar(guardado)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        leido = uow.aniimos.obtener(guardado.id)
    assert leido == guardado
    assert leido is not None
    assert leido.stats[Stat.ATQ].notas == "Tope de potencial"
    assert [(m.tengo, m.necesito) for m in leido.materiales] == [(413, 60), (1, 2), (3, 10)]
    assert [o.posicion for o in leido.objetos] == [
        PosicionObjeto.EQUIPADO,
        PosicionObjeto.ALTERNATIVO,
    ]


def test_round_trip_de_texto_libre_con_saltos_de_linea(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    aniimo = AniimoDelTeam(
        team_id=team.id,
        slot=2,
        nombre="Con notas",
        notas_habilidades="Primera\nSegunda\n\nTercera con acentos: cancion",
    )
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.agregar(aniimo)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.obtener(aniimo.id) == aniimo


def test_aniimo_minimo_se_relee_con_opcionales_en_none(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    minimo = AniimoDelTeam(team_id=team.id, slot=4, nombre="Minimo")
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.agregar(minimo)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        leido = uow.aniimos.obtener(minimo.id)
    assert leido == minimo
    assert leido is not None
    assert leido.elemento is None
    assert leido.personalidad is None
    assert leido.nivel_requerido_siguiente_etapa is None
    assert leido.materiales == ()
    assert leido.objetos == ()


def test_actualizar_cambia_stats_y_reemplaza_hijos(
    session_factory: sessionmaker[Session], irisalis: AniimoDelTeam
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    original = dataclasses.replace(irisalis, team_id=team.id)
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.agregar(original)
        uow.commit()

    stats = {**original.stats, Stat.PS: ValoresDeStat(valor_actual=12000, potencial=12)}
    actualizado = dataclasses.replace(
        original,
        nivel=61,
        cp=3600,
        stats=stats,
        despertares_usados=30,
        materiales=(MaterialEstrella(posicion=1, nombre="Nuevo polvo", tengo=5, necesito=5),),
        objetos=(
            ObjetoTransportado(
                posicion=PosicionObjeto.ALTERNATIVO, nombre="Amuleto", rareza=Rareza.EPICA, nivel=9
            ),
        ),
        notas=None,
    )
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.actualizar(actualizado)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        leido = uow.aniimos.obtener(original.id)
    assert leido == actualizado
    assert leido is not None
    assert [m.nombre for m in leido.materiales] == ["Nuevo polvo"]
    assert [o.nombre for o in leido.objetos] == ["Amuleto"]


def test_actualizar_puede_vaciar_los_hijos_y_reusar_posiciones(
    session_factory: sessionmaker[Session], irisalis: AniimoDelTeam
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario)
    original = dataclasses.replace(irisalis, team_id=team.id)
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.agregar(original)
        uow.commit()

    vacio = dataclasses.replace(original, materiales=(), objetos=())
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.actualizar(vacio)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.obtener(original.id) == vacio

    con_material = dataclasses.replace(
        vacio, materiales=(MaterialEstrella(posicion=1, nombre="Otra vez", tengo=1, necesito=2),)
    )
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.actualizar(con_material)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.obtener(original.id) == con_material


def test_actualizar_usuario_conserva_igualdad(session_factory: sessionmaker[Session]) -> None:
    usuario = persistir_usuario(session_factory)
    cambiado = Usuario(
        usuario.nombre_usuario, "otro-hash", id=usuario.id, creado_en=usuario.creado_en
    )
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.actualizar(cambiado)
        uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(usuario.id) == cambiado
