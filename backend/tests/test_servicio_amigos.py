from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.application.amigos import Relacion, ServicioDeAmigos
from app.application.teams import ServicioDeTeams
from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import AniimoDelTeam, Team, Usuario
from app.domain.errores import (
    AmistadExistente,
    AmistadNoEncontrada,
    AutoAmistad,
    TeamNoEncontrado,
    UsuarioNoEncontrado,
)
from app.domain.imagenes import TipoDeImagen
from tests.fabricas import RelojFalso, datos_de_ficha, persistir_team, persistir_usuario
from tests.imagenes_de_prueba import PNG


@pytest.fixture
def servicio(session_factory: sessionmaker[Session], reloj: RelojFalso) -> ServicioDeAmigos:
    return ServicioDeAmigos(session_factory, reloj)


@pytest.fixture
def teams(session_factory: sessionmaker[Session]) -> ServicioDeTeams:
    return ServicioDeTeams(session_factory)


@pytest.fixture
def a(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "ana")


@pytest.fixture
def b(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "bruno")


@pytest.fixture
def c(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "carla")


@pytest.fixture
def d(session_factory: sessionmaker[Session]) -> Usuario:
    return persistir_usuario(session_factory, "dario")


def _hacer_amigos(servicio: ServicioDeAmigos, uno: Usuario, otro: Usuario) -> None:
    servicio.enviar_solicitud(uno.id, otro.id)
    servicio.aceptar(otro.id, uno.id)


def _nombres(entradas: tuple) -> list[str]:  # type: ignore[type-arg]
    return [e.usuario.nombre_usuario for e in entradas]


def _filas_de_amistad(session_factory: sessionmaker[Session], uno: Usuario) -> int:
    with UnitOfWork(session_factory) as uow:
        return len(uow.amistades.listar_de(uno.id))


# --- buscar ---


def test_buscar_exacto_normalizado_sin_relacion(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario
) -> None:
    encontrado = servicio.buscar(a.id, "BRUNO")
    assert encontrado is not None
    assert encontrado.usuario.id == b.id
    assert encontrado.relacion is Relacion.NINGUNA


def test_buscar_sin_coincidencia_parcial_ni_inexistente(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario
) -> None:
    assert servicio.buscar(a.id, "bru") is None
    assert servicio.buscar(a.id, "nadie") is None


def test_buscar_a_uno_mismo_devuelve_none(servicio: ServicioDeAmigos, a: Usuario) -> None:
    assert servicio.buscar(a.id, "ana") is None
    assert servicio.buscar(a.id, "ANA") is None


def test_buscar_informa_la_relacion_en_los_cuatro_estados(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, c: Usuario, d: Usuario
) -> None:
    servicio.enviar_solicitud(a.id, b.id)
    servicio.enviar_solicitud(c.id, a.id)
    _hacer_amigos(servicio, a, d)
    relaciones = {
        nombre: servicio.buscar(a.id, nombre).relacion  # type: ignore[union-attr]
        for nombre in ("bruno", "carla", "dario")
    }
    assert relaciones == {
        "bruno": Relacion.SOLICITUD_ENVIADA,
        "carla": Relacion.SOLICITUD_RECIBIDA,
        "dario": Relacion.AMIGO,
    }


def test_buscar_ve_la_relacion_desde_el_otro_lado(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario
) -> None:
    servicio.enviar_solicitud(a.id, b.id)
    visto_por_b = servicio.buscar(b.id, "ana")
    assert visto_por_b is not None
    assert visto_por_b.relacion is Relacion.SOLICITUD_RECIBIDA


# --- listar ---


def test_listar_separa_amigos_recibidas_y_enviadas_ordenadas(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, c: Usuario, d: Usuario
) -> None:
    _hacer_amigos(servicio, a, d)
    _hacer_amigos(servicio, b, a)
    servicio.enviar_solicitud(c.id, a.id)
    lista = servicio.listar(a.id)
    assert _nombres(lista.amigos) == ["bruno", "dario"]
    assert _nombres(lista.recibidas) == ["carla"]
    assert lista.enviadas == ()


def test_listar_enviadas_ordenadas_por_nombre(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, c: Usuario
) -> None:
    servicio.enviar_solicitud(a.id, c.id)
    servicio.enviar_solicitud(a.id, b.id)
    assert _nombres(servicio.listar(a.id).enviadas) == ["bruno", "carla"]


def test_listar_incluye_las_fechas(
    servicio: ServicioDeAmigos, reloj: RelojFalso, a: Usuario, b: Usuario
) -> None:
    reloj.ahora = datetime(2026, 3, 1, tzinfo=UTC)
    servicio.enviar_solicitud(a.id, b.id)
    reloj.ahora = datetime(2026, 3, 2, tzinfo=UTC)
    servicio.aceptar(b.id, a.id)
    [amigo] = servicio.listar(a.id).amigos
    assert amigo.desde == datetime(2026, 3, 2, tzinfo=UTC)


def test_listar_solo_las_propias(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, c: Usuario
) -> None:
    _hacer_amigos(servicio, b, c)
    lista = servicio.listar(a.id)
    assert (lista.amigos, lista.recibidas, lista.enviadas) == ((), (), ())


# --- enviar_solicitud ---


def test_enviar_solicitud_nueva(servicio: ServicioDeAmigos, a: Usuario, b: Usuario) -> None:
    resultado = servicio.enviar_solicitud(a.id, b.id)
    assert resultado.usuario.id == b.id
    assert resultado.relacion is Relacion.SOLICITUD_ENVIADA
    assert _nombres(servicio.listar(b.id).recibidas) == ["ana"]


@pytest.mark.parametrize("cruzada", [False, True])
def test_solicitud_repetida_o_cruzada_lanza_amistad_existente(
    servicio: ServicioDeAmigos,
    session_factory: sessionmaker[Session],
    a: Usuario,
    b: Usuario,
    cruzada: bool,
) -> None:
    servicio.enviar_solicitud(a.id, b.id)
    with pytest.raises(AmistadExistente):
        if cruzada:
            servicio.enviar_solicitud(b.id, a.id)
        else:
            servicio.enviar_solicitud(a.id, b.id)
    assert _filas_de_amistad(session_factory, a) == 1


def test_solicitud_entre_amigos_lanza_amistad_existente(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario
) -> None:
    _hacer_amigos(servicio, a, b)
    with pytest.raises(AmistadExistente):
        servicio.enviar_solicitud(a.id, b.id)


def test_solicitud_a_un_usuario_inexistente(servicio: ServicioDeAmigos, a: Usuario) -> None:
    with pytest.raises(UsuarioNoEncontrado):
        servicio.enviar_solicitud(a.id, uuid4())


def test_solicitud_a_uno_mismo(servicio: ServicioDeAmigos, a: Usuario) -> None:
    with pytest.raises(AutoAmistad):
        servicio.enviar_solicitud(a.id, a.id)


# --- aceptar ---


def test_aceptar_hace_amigos_a_los_dos(servicio: ServicioDeAmigos, a: Usuario, c: Usuario) -> None:
    servicio.enviar_solicitud(c.id, a.id)
    resultado = servicio.aceptar(a.id, c.id)
    assert resultado.relacion is Relacion.AMIGO
    assert resultado.usuario.id == c.id
    assert _nombres(servicio.listar(a.id).amigos) == ["carla"]
    assert _nombres(servicio.listar(c.id).amigos) == ["ana"]


def test_el_solicitante_no_puede_aceptar_su_propia_solicitud(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario
) -> None:
    servicio.enviar_solicitud(a.id, b.id)
    with pytest.raises(AmistadNoEncontrada):
        servicio.aceptar(a.id, b.id)
    assert _nombres(servicio.listar(a.id).enviadas) == ["bruno"]
    assert servicio.listar(a.id).amigos == ()


def test_aceptar_sin_fila_o_ya_aceptada(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, c: Usuario
) -> None:
    with pytest.raises(AmistadNoEncontrada):
        servicio.aceptar(a.id, c.id)
    _hacer_amigos(servicio, a, b)
    with pytest.raises(AmistadNoEncontrada):
        servicio.aceptar(a.id, b.id)
    with pytest.raises(AmistadNoEncontrada):
        servicio.aceptar(b.id, a.id)


# --- eliminar ---


@pytest.mark.parametrize("quien_borra", ["solicitante", "destinatario"])
def test_eliminar_una_solicitud_pendiente_por_cualquiera_de_los_dos(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, quien_borra: str
) -> None:
    servicio.enviar_solicitud(a.id, b.id)
    borra, otro = (a, b) if quien_borra == "solicitante" else (b, a)
    servicio.eliminar(borra.id, otro.id)
    for usuario in (a, b):
        lista = servicio.listar(usuario.id)
        assert (lista.amigos, lista.recibidas, lista.enviadas) == ((), (), ())


@pytest.mark.parametrize("quien_borra", ["solicitante", "destinatario"])
def test_eliminar_una_amistad_aceptada_por_cualquiera_de_los_dos(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, quien_borra: str
) -> None:
    _hacer_amigos(servicio, a, b)
    borra, otro = (a, b) if quien_borra == "solicitante" else (b, a)
    servicio.eliminar(borra.id, otro.id)
    assert servicio.listar(a.id).amigos == ()
    assert servicio.listar(b.id).amigos == ()


def test_eliminar_sin_fila(servicio: ServicioDeAmigos, a: Usuario, b: Usuario) -> None:
    with pytest.raises(AmistadNoEncontrada):
        servicio.eliminar(a.id, b.id)


def test_despues_de_eliminar_se_puede_volver_a_pedir(
    servicio: ServicioDeAmigos, a: Usuario, c: Usuario
) -> None:
    servicio.enviar_solicitud(c.id, a.id)
    servicio.eliminar(a.id, c.id)
    servicio.enviar_solicitud(c.id, a.id)
    assert _nombres(servicio.listar(a.id).recibidas) == ["carla"]


# --- lecturas de amigos ---


@pytest.fixture
def team_de_b(
    session_factory: sessionmaker[Session],
    teams: ServicioDeTeams,
    b: Usuario,
    irisalis: AniimoDelTeam,
) -> Team:
    team = persistir_team(session_factory, b, orden=1)
    teams.guardar_ficha(b.id, team.id, 1, datos_de_ficha(irisalis))
    teams.guardar_imagen(b.id, team.id, 1, TipoDeImagen.PNG, PNG)
    return team


def test_el_amigo_aceptado_lee_igual_que_el_duenio(
    servicio: ServicioDeAmigos, teams: ServicioDeTeams, a: Usuario, b: Usuario, team_de_b: Team
) -> None:
    _hacer_amigos(servicio, a, b)
    usuario, resumenes = servicio.teams_de_amigo(a.id, b.id)
    assert usuario.id == b.id
    assert resumenes == teams.listar(b.id)
    assert servicio.ficha_de_amigo(a.id, b.id, team_de_b.id, 1) == teams.obtener_ficha(
        b.id, team_de_b.id, 1
    )
    imagen = servicio.imagen_de_amigo(a.id, b.id, team_de_b.id, 1)
    assert imagen is not None
    assert imagen.datos == PNG


def test_slot_vacio_y_sin_imagen_devuelven_none(
    servicio: ServicioDeAmigos,
    teams: ServicioDeTeams,
    a: Usuario,
    b: Usuario,
    team_de_b: Team,
    irisalis: AniimoDelTeam,
) -> None:
    _hacer_amigos(servicio, a, b)
    teams.guardar_ficha(b.id, team_de_b.id, 2, datos_de_ficha(irisalis))
    assert servicio.ficha_de_amigo(a.id, b.id, team_de_b.id, 3) is None
    assert servicio.imagen_de_amigo(a.id, b.id, team_de_b.id, 3) is None
    assert servicio.imagen_de_amigo(a.id, b.id, team_de_b.id, 2) is None


def _sin_acceso(servicio: ServicioDeAmigos, a: Usuario, otro_id: UUID, team_id: UUID) -> None:
    with pytest.raises(AmistadNoEncontrada):
        servicio.teams_de_amigo(a.id, otro_id)
    with pytest.raises(AmistadNoEncontrada):
        servicio.ficha_de_amigo(a.id, otro_id, team_id, 1)
    with pytest.raises(AmistadNoEncontrada):
        servicio.imagen_de_amigo(a.id, otro_id, team_id, 1)


def test_pendiente_en_ambos_sentidos_no_da_acceso(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, c: Usuario, team_de_b: Team
) -> None:
    servicio.enviar_solicitud(a.id, b.id)
    _sin_acceso(servicio, a, b.id, team_de_b.id)
    _sin_acceso(servicio, b, a.id, team_de_b.id)
    servicio.enviar_solicitud(c.id, b.id)
    _sin_acceso(servicio, b, c.id, team_de_b.id)


def test_sin_relacion_inexistente_y_uno_mismo_no_dan_acceso(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, team_de_b: Team
) -> None:
    _sin_acceso(servicio, a, b.id, team_de_b.id)
    _sin_acceso(servicio, a, uuid4(), team_de_b.id)
    _sin_acceso(servicio, b, b.id, team_de_b.id)


def test_team_de_un_tercero_o_inexistente_por_la_ruta_de_un_amigo(
    servicio: ServicioDeAmigos,
    session_factory: sessionmaker[Session],
    a: Usuario,
    b: Usuario,
    c: Usuario,
    team_de_b: Team,
) -> None:
    _hacer_amigos(servicio, a, c)
    team_de_c = persistir_team(session_factory, c, orden=1)
    for team_id in (team_de_b.id, uuid4()):
        with pytest.raises(TeamNoEncontrado):
            servicio.ficha_de_amigo(a.id, c.id, team_id, 1)
        with pytest.raises(TeamNoEncontrado):
            servicio.imagen_de_amigo(a.id, c.id, team_id, 1)
    assert servicio.ficha_de_amigo(a.id, c.id, team_de_c.id, 1) is None


def test_team_oculto_no_se_lista_ni_se_lee_y_visible_vuelve_a_aparecer(
    servicio: ServicioDeAmigos,
    teams: ServicioDeTeams,
    session_factory: sessionmaker[Session],
    a: Usuario,
    b: Usuario,
    team_de_b: Team,
) -> None:
    _hacer_amigos(servicio, a, b)
    otro_visible = persistir_team(session_factory, b, orden=2)
    teams.editar(b.id, team_de_b.id, oculto_para_amigos=True)
    _, resumenes = servicio.teams_de_amigo(a.id, b.id)
    assert [r.team.id for r in resumenes] == [otro_visible.id]
    with pytest.raises(TeamNoEncontrado):
        servicio.ficha_de_amigo(a.id, b.id, team_de_b.id, 1)
    with pytest.raises(TeamNoEncontrado):
        servicio.imagen_de_amigo(a.id, b.id, team_de_b.id, 1)
    teams.editar(b.id, team_de_b.id, oculto_para_amigos=False)
    _, resumenes = servicio.teams_de_amigo(a.id, b.id)
    assert [r.team.id for r in resumenes] == [team_de_b.id, otro_visible.id]
    assert servicio.ficha_de_amigo(a.id, b.id, team_de_b.id, 1) is not None


def test_el_acceso_se_pierde_al_eliminar_la_amistad(
    servicio: ServicioDeAmigos, a: Usuario, b: Usuario, team_de_b: Team
) -> None:
    _hacer_amigos(servicio, a, b)
    servicio.teams_de_amigo(a.id, b.id)
    servicio.eliminar(b.id, a.id)
    _sin_acceso(servicio, a, b.id, team_de_b.id)
