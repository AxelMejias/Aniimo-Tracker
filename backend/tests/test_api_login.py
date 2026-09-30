from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from tests.fabricas import CLAVE, RelojFalso, iniciar_sesion, registrar


def _sesiones(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as session:
        return session.execute(text("SELECT count(*) FROM sesion")).scalar_one()


def test_login_correcto_devuelve_token_y_no_se_cachea(
    cliente_api: TestClient, reloj: RelojFalso
) -> None:
    registrar(cliente_api)
    respuesta = iniciar_sesion(cliente_api, "Axel")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert set(cuerpo) == {"access_token", "token_type", "expira_en"}
    assert cuerpo["access_token"]
    assert cuerpo["token_type"] == "bearer"
    assert datetime.fromisoformat(cuerpo["expira_en"]) == reloj.ahora + timedelta(minutes=30)
    assert respuesta.headers["cache-control"] == "no-store"


def test_login_correcto_crea_una_sesion(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    registrar(cliente_api)
    iniciar_sesion(cliente_api)
    assert _sesiones(session_factory) == 1


def test_contrasena_incorrecta_y_usuario_inexistente_responden_igual(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    registrar(cliente_api)
    incorrecta = iniciar_sesion(cliente_api, "axel", "otra-clave-larga")
    inexistente = iniciar_sesion(cliente_api, "nadie", CLAVE)
    assert incorrecta.status_code == inexistente.status_code == 401
    assert incorrecta.json() == inexistente.json() == {"detail": "Credenciales inválidas"}
    assert incorrecta.headers.get("www-authenticate") == inexistente.headers.get("www-authenticate")
    assert _sesiones(session_factory) == 0


@pytest.mark.parametrize("nombre", ["no existe!", "x", "a" * 64, "ñ", "axel\n"])
def test_nombre_con_formato_imposible_responde_401(cliente_api: TestClient, nombre: str) -> None:
    respuesta = iniciar_sesion(cliente_api, nombre, "x")
    assert respuesta.status_code == 401
    assert respuesta.json() == {"detail": "Credenciales inválidas"}


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"nombre_usuario": "", "contrasena": "x"},
        {"nombre_usuario": "a" * 65, "contrasena": "x"},
        {"nombre_usuario": "axel", "contrasena": ""},
        {"nombre_usuario": "axel", "contrasena": "x" * 129},
        {"nombre_usuario": 1, "contrasena": "x"},
        {"nombre_usuario": "axel", "contrasena": "x", "extra": 1},
    ],
)
def test_login_solo_valida_tipos_y_largos(
    cliente_api: TestClient, cuerpo: dict[str, object]
) -> None:
    assert cliente_api.post("/api/auth/login", json=cuerpo).status_code == 422
