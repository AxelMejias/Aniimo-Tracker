import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy.orm import Session, sessionmaker

from tests.fabricas import ClienteAutenticado, Red, persona


def _buscar(cliente: ClienteAutenticado, nombre: str) -> Response:
    return cliente.get("/api/usuarios", params={"nombre_usuario": nombre})


def test_usuario_existente_sin_relacion(red: Red) -> None:
    respuesta = _buscar(red.a.api, "Usuario_E")
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "usuario": {"id": str(red.e.id), "nombre_usuario": "usuario_e", "relacion": "ninguna"}
    }


@pytest.mark.parametrize(
    ("nombre", "relacion"),
    [
        ("usuario_d", "solicitud_enviada"),
        ("usuario_c", "solicitud_recibida"),
        ("usuario_b", "amigo"),
    ],
)
def test_relacion_en_cada_estado(red: Red, nombre: str, relacion: str) -> None:
    cuerpo = _buscar(red.a.api, nombre).json()
    assert cuerpo["usuario"]["relacion"] == relacion


def test_la_relacion_se_ve_desde_el_otro_lado(red: Red) -> None:
    assert _buscar(red.d.api, "usuario_a").json()["usuario"]["relacion"] == "solicitud_recibida"
    assert _buscar(red.c.api, "usuario_a").json()["usuario"]["relacion"] == "solicitud_enviada"


@pytest.mark.parametrize("parcial", ["usuario", "usuario_", "sua", "usuario_"])
def test_sin_coincidencia_parcial(red: Red, parcial: str) -> None:
    respuesta = _buscar(red.a.api, parcial)
    assert respuesta.status_code == 200
    assert respuesta.json() == {"usuario": None}


def test_inexistente(red: Red) -> None:
    assert _buscar(red.a.api, "nadie_aca").json() == {"usuario": None}


def test_uno_mismo(red: Red) -> None:
    assert _buscar(red.a.api, "usuario_a").json() == {"usuario": None}
    assert _buscar(red.a.api, "USUARIO_A").json() == {"usuario": None}


def test_la_respuesta_no_expone_mas_datos_que_id_nombre_y_relacion(red: Red) -> None:
    usuario = _buscar(red.a.api, "usuario_b").json()["usuario"]
    assert set(usuario) == {"id", "nombre_usuario", "relacion"}


@pytest.mark.parametrize("nombre", ["ab", "nombre con espacios", "x" * 33, "bad-name", ""])
def test_nombre_mal_formado_responde_422_sin_eco(red: Red, nombre: str) -> None:
    respuesta = _buscar(red.a.api, nombre)
    assert respuesta.status_code == 422
    if nombre:
        assert nombre not in respuesta.text


def test_sin_el_parametro_responde_422(red: Red) -> None:
    assert red.a.api.get("/api/usuarios").status_code == 422


def test_la_respuesta_no_se_cachea(red: Red) -> None:
    assert _buscar(red.a.api, "usuario_b").headers["Cache-Control"] == "no-store"


def test_sin_token_responde_401(cliente_api: TestClient) -> None:
    respuesta = cliente_api.get("/api/usuarios", params={"nombre_usuario": "alguien"})
    assert respuesta.status_code == 401
    assert respuesta.headers["WWW-Authenticate"] == "Bearer"


def test_buscar_ignora_la_capitalizacion_guardada(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    uno = persona(cliente_api, session_factory, "Mayus_Uno")
    otro = persona(cliente_api, session_factory, "otro_usr")
    assert _buscar(otro.api, "MAYUS_UNO").json()["usuario"]["id"] == str(uno.id)
