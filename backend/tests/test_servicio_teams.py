from dataclasses import replace
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.application.teams import ServicioDeTeams
from app.application.unit_of_work import UnitOfWork
from app.domain.catalogos import PosicionObjeto
from app.domain.entidades import AniimoDelTeam, ImagenAniimo, Team, Usuario
from app.domain.errores import (
    AniimoNoEncontrado,
    ImagenDemasiadoGrande,
    ImagenInvalida,
    LimiteDeTeamsAlcanzado,
    TeamNoEncontrado,
)
from app.domain.imagenes import TAMANO_MAXIMO, TipoDeImagen
from tests.fabricas import datos_de_ficha, persistir_team, persistir_usuario
from tests.imagenes_de_prueba import JPEG, PNG, WEBP, con_relleno


@pytest.fixture
def servicio(session_factory: sessionmaker[Session]) -> ServicioDeTeams:
    return ServicioDeTeams(session_factory)


@pytest.fixture
def usuario(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "axel")


@pytest.fixture
def otro(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "otro")


@pytest.fixture
def team(session_factory: sessionmaker[Session], usuario: Usuario) -> Team:
    return persistir_team(session_factory, usuario)


def _ordenes(servicio: ServicioDeTeams, usuario: Usuario) -> list[int]:
    return [resumen.team.orden for resumen in servicio.listar(usuario.id)]


def test_listar_sin_teams_devuelve_lista_vacia(servicio: ServicioDeTeams, usuario: Usuario) -> None:
    assert servicio.listar(usuario.id) == []


def test_listar_arma_cuatro_slots_por_team_con_resumen_e_imagen(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    servicio.guardar_ficha(usuario.id, team.id, 3, datos_de_ficha(irisalis, nombre="Otro"))
    servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.PNG, PNG)
    [resumen] = servicio.listar(usuario.id)
    assert resumen.team == team
    assert [s.slot for s in resumen.slots] == [1, 2, 3, 4]
    assert [s.aniimo is not None for s in resumen.slots] == [True, False, True, False]
    assert [s.tiene_imagen for s in resumen.slots] == [True, False, False, False]
    primero = resumen.slots[0].aniimo
    assert primero is not None
    assert (primero.nombre, primero.nivel, primero.cp) == ("Irisalis", 60, 3475)


def test_listar_solo_trae_los_teams_del_usuario(
    servicio: ServicioDeTeams,
    session_factory: sessionmaker[Session],
    usuario: Usuario,
    otro: Usuario,
    team: Team,
) -> None:
    persistir_team(session_factory, otro)
    assert [r.team for r in servicio.listar(usuario.id)] == [team]


def test_crear_asigna_la_menor_posicion_libre(servicio: ServicioDeTeams, usuario: Usuario) -> None:
    creados = [servicio.crear(usuario.id, f"T{n}") for n in (1, 2, 3)]
    assert [c.team.orden for c in creados] == [1, 2, 3]
    servicio.borrar(usuario.id, creados[1].team.id)
    assert servicio.crear(usuario.id, "Nuevo").team.orden == 2
    assert _ordenes(servicio, usuario) == [1, 2, 3]


def test_crear_devuelve_cuatro_slots_vacios(servicio: ServicioDeTeams, usuario: Usuario) -> None:
    resumen = servicio.crear(usuario.id, "Raid")
    assert resumen.team.nombre == "Raid"
    assert [(s.slot, s.aniimo, s.tiene_imagen) for s in resumen.slots] == [
        (n, None, False) for n in (1, 2, 3, 4)
    ]


def test_crear_un_quinto_team_lanza_limite_y_no_crea_nada(
    servicio: ServicioDeTeams, usuario: Usuario
) -> None:
    for n in range(4):
        servicio.crear(usuario.id, f"T{n}")
    with pytest.raises(LimiteDeTeamsAlcanzado):
        servicio.crear(usuario.id, "Otro")
    assert _ordenes(servicio, usuario) == [1, 2, 3, 4]


def test_el_limite_de_teams_es_por_usuario(
    servicio: ServicioDeTeams, usuario: Usuario, otro: Usuario
) -> None:
    for n in range(4):
        servicio.crear(usuario.id, f"T{n}")
    assert servicio.crear(otro.id, "Mio").team.orden == 1


def test_renombrar_cambia_solo_el_nombre(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    resumen = servicio.renombrar(usuario.id, team.id, "Raid")
    assert resumen.team == replace(team, nombre="Raid")
    assert resumen.slots[0].aniimo is not None


def test_renombrar_un_team_ajeno_lanza_no_encontrado_sin_cambios(
    servicio: ServicioDeTeams, otro: Usuario, usuario: Usuario, team: Team
) -> None:
    with pytest.raises(TeamNoEncontrado):
        servicio.renombrar(otro.id, team.id, "Robado")
    assert [r.team for r in servicio.listar(usuario.id)] == [team]


def test_borrar_un_team_ajeno_o_inexistente_lanza_no_encontrado_sin_cambios(
    servicio: ServicioDeTeams, otro: Usuario, usuario: Usuario, team: Team
) -> None:
    with pytest.raises(TeamNoEncontrado):
        servicio.borrar(otro.id, team.id)
    with pytest.raises(TeamNoEncontrado):
        servicio.borrar(usuario.id, uuid4())
    assert [r.team for r in servicio.listar(usuario.id)] == [team]


def test_borrar_un_team_borra_sus_aniimo_e_imagenes(
    servicio: ServicioDeTeams,
    session_factory: sessionmaker[Session],
    usuario: Usuario,
    team: Team,
    irisalis: AniimoDelTeam,
) -> None:
    ficha = servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.PNG, PNG)
    servicio.borrar(usuario.id, team.id)
    with UnitOfWork(session_factory) as uow:
        assert uow.aniimos.obtener(ficha.aniimo.id) is None
        assert uow.imagenes.obtener(ficha.aniimo.id) is None


def test_obtener_ficha_de_un_slot_vacio_es_none(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team
) -> None:
    assert servicio.obtener_ficha(usuario.id, team.id, 2) is None


def test_guardar_ficha_crea_en_un_slot_vacio(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    guardada = servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    assert guardada.tiene_imagen is False
    assert guardada.aniimo == replace(irisalis, team_id=team.id, id=guardada.aniimo.id)
    assert servicio.obtener_ficha(usuario.id, team.id, 1) == guardada


def test_guardar_ficha_reemplaza_conservando_id_e_imagen_y_reemplazando_hijos(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    original = servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.WEBP, WEBP)
    reemplazo = servicio.guardar_ficha(
        usuario.id,
        team.id,
        1,
        datos_de_ficha(irisalis, nombre="Editada", materiales=irisalis.materiales[:1], objetos=()),
    )
    assert reemplazo.aniimo.id == original.aniimo.id
    assert reemplazo.aniimo.nombre == "Editada"
    assert len(reemplazo.aniimo.materiales) == 1
    assert reemplazo.aniimo.objetos == ()
    assert reemplazo.tiene_imagen is True


def test_guardar_ficha_reemplaza_los_objetos_por_posicion(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    solo_alternativo = tuple(
        o for o in irisalis.objetos if o.posicion is PosicionObjeto.ALTERNATIVO
    )
    reemplazo = servicio.guardar_ficha(
        usuario.id, team.id, 1, datos_de_ficha(irisalis, objetos=solo_alternativo)
    )
    assert reemplazo.aniimo.objetos == solo_alternativo


def test_vaciar_slot_es_idempotente_y_no_toca_otros_slots(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    servicio.guardar_ficha(usuario.id, team.id, 2, datos_de_ficha(irisalis, nombre="Dos"))
    servicio.vaciar_slot(usuario.id, team.id, 1)
    servicio.vaciar_slot(usuario.id, team.id, 1)
    assert servicio.obtener_ficha(usuario.id, team.id, 1) is None
    assert servicio.obtener_ficha(usuario.id, team.id, 2) is not None


def test_las_operaciones_de_ficha_sobre_un_team_ajeno_lanzan_no_encontrado(
    servicio: ServicioDeTeams, usuario: Usuario, otro: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    with pytest.raises(TeamNoEncontrado):
        servicio.obtener_ficha(otro.id, team.id, 1)
    with pytest.raises(TeamNoEncontrado):
        servicio.guardar_ficha(otro.id, team.id, 1, datos_de_ficha(irisalis, nombre="Robada"))
    with pytest.raises(TeamNoEncontrado):
        servicio.vaciar_slot(otro.id, team.id, 1)
    propia = servicio.obtener_ficha(usuario.id, team.id, 1)
    assert propia is not None
    assert propia.aniimo.nombre == "Irisalis"


def test_las_operaciones_de_imagen_en_slot_vacio_lanzan_aniimo_no_encontrado(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team
) -> None:
    with pytest.raises(AniimoNoEncontrado):
        servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.PNG, PNG)
    with pytest.raises(AniimoNoEncontrado):
        servicio.obtener_imagen(usuario.id, team.id, 1)
    with pytest.raises(AniimoNoEncontrado):
        servicio.borrar_imagen(usuario.id, team.id, 1)


def test_imagen_guardar_reemplazar_y_obtener(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    ficha = servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    assert servicio.obtener_imagen(usuario.id, team.id, 1) is None
    servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.PNG, PNG)
    servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.JPEG, JPEG)
    assert servicio.obtener_imagen(usuario.id, team.id, 1) == ImagenAniimo(
        ficha.aniimo.id, TipoDeImagen.JPEG, JPEG
    )


def test_borrar_imagen_sin_imagen_no_falla_y_con_imagen_la_quita(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    servicio.borrar_imagen(usuario.id, team.id, 1)
    servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.PNG, PNG)
    servicio.borrar_imagen(usuario.id, team.id, 1)
    assert servicio.obtener_imagen(usuario.id, team.id, 1) is None
    ficha = servicio.obtener_ficha(usuario.id, team.id, 1)
    assert ficha is not None
    assert ficha.tiene_imagen is False


def test_guardar_una_imagen_invalida_no_guarda_nada(
    servicio: ServicioDeTeams, usuario: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    with pytest.raises(ImagenInvalida):
        servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.PNG, JPEG)
    with pytest.raises(ImagenDemasiadoGrande):
        servicio.guardar_imagen(
            usuario.id, team.id, 1, TipoDeImagen.PNG, con_relleno(PNG, TAMANO_MAXIMO + 1)
        )
    assert servicio.obtener_imagen(usuario.id, team.id, 1) is None


def test_las_operaciones_de_imagen_sobre_un_team_ajeno_lanzan_no_encontrado(
    servicio: ServicioDeTeams, usuario: Usuario, otro: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    servicio.guardar_imagen(usuario.id, team.id, 1, TipoDeImagen.PNG, PNG)
    with pytest.raises(TeamNoEncontrado):
        servicio.guardar_imagen(otro.id, team.id, 1, TipoDeImagen.WEBP, WEBP)
    with pytest.raises(TeamNoEncontrado):
        servicio.obtener_imagen(otro.id, team.id, 1)
    with pytest.raises(TeamNoEncontrado):
        servicio.borrar_imagen(otro.id, team.id, 1)
    imagen = servicio.obtener_imagen(usuario.id, team.id, 1)
    assert imagen is not None
    assert imagen.datos == PNG


def test_comprobar_aniimo_distingue_team_ajeno_y_slot_vacio(
    servicio: ServicioDeTeams, usuario: Usuario, otro: Usuario, team: Team, irisalis: AniimoDelTeam
) -> None:
    servicio.guardar_ficha(usuario.id, team.id, 1, datos_de_ficha(irisalis))
    servicio.comprobar_aniimo(usuario.id, team.id, 1)
    with pytest.raises(TeamNoEncontrado):
        servicio.comprobar_aniimo(otro.id, team.id, 1)
    with pytest.raises(AniimoNoEncontrado):
        servicio.comprobar_aniimo(usuario.id, team.id, 2)
