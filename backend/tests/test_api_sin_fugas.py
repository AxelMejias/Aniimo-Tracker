import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from tests.fabricas import CLAVE, con_token, iniciar_sesion, registrar

SECRETA = "clave-secreta-123"


def test_422_no_devuelve_la_contrasena_enviada(cliente_api: TestClient) -> None:
    respuesta = cliente_api.post(
        "/api/auth/register",
        json={"nombre_usuario": "axel", "contrasena": SECRETA, "extra": "campo-no-permitido"},
    )
    assert respuesta.status_code == 422
    assert SECRETA not in respuesta.text
    assert "campo-no-permitido" not in respuesta.text


def test_cada_error_de_validacion_tiene_solo_loc_msg_y_type(cliente_api: TestClient) -> None:
    respuesta = cliente_api.post(
        "/api/auth/register",
        json={"nombre_usuario": "a!", "contrasena": "corta", "extra": 1},
    )
    errores = respuesta.json()["detail"]
    assert len(errores) == 3
    for error in errores:
        assert set(error) == {"loc", "msg", "type"}


def test_422_de_login_tampoco_devuelve_la_contrasena(cliente_api: TestClient) -> None:
    respuesta = cliente_api.post(
        "/api/auth/login",
        json={"nombre_usuario": "axel", "contrasena": SECRETA, "extra": 1},
    )
    assert respuesta.status_code == 422
    assert SECRETA not in respuesta.text


def test_cuerpo_que_no_es_json_no_se_devuelve(cliente_api: TestClient) -> None:
    respuesta = cliente_api.post(
        "/api/auth/login",
        content=f'{{"contrasena": "{SECRETA}", ',
        headers={"Content-Type": "application/json"},
    )
    assert respuesta.status_code == 422
    assert SECRETA not in respuesta.text


def _mensajes(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [registro.getMessage() for registro in caplog.records]


def test_los_eventos_se_registran_sin_secretos(
    cliente_api: TestClient,
    session_factory: sessionmaker[Session],
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.DEBUG):
        registrar(cliente_api, "axel", SECRETA)
        iniciar_sesion(cliente_api, "axel", "otra-clave-larga-1")
        token = iniciar_sesion(cliente_api, "axel", SECRETA).json()["access_token"]
        cliente_api.get("/api/auth/me", headers=con_token(token))
        cliente_api.post("/api/auth/logout", headers=con_token(token))
        for _ in range(5):
            iniciar_sesion(cliente_api, "axel", "otra-clave-larga-2")
        bloqueado = iniciar_sesion(cliente_api, "axel", SECRETA)
    assert bloqueado.status_code == 429
    with UnitOfWork(session_factory) as uow:
        hash_guardado = uow.usuarios.obtener_por_nombre_usuario("axel").password_hash
    texto = "\n".join(_mensajes(caplog) + [registro.exc_text or "" for registro in caplog.records])
    for secreto in (SECRETA, "otra-clave-larga-1", "otra-clave-larga-2", token, hash_guardado):
        assert secreto not in texto
    assert "authorization" not in texto.lower()
    for evento in ("registro ok", "login ok", "login fallido", "logout", "limite"):
        assert evento in texto


def test_login_fallido_se_registra_como_warning_con_el_nombre(
    cliente_api: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    registrar(cliente_api, "axel")
    with caplog.at_level(logging.INFO, logger="app.auth"):
        iniciar_sesion(cliente_api, "AXEL", "otra-clave-larga")
    fallidos = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(fallidos) == 1
    assert "axel" in fallidos[0].getMessage()


def test_login_fallido_de_usuario_inexistente_se_ve_igual_que_uno_existente(
    cliente_api: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    registrar(cliente_api, "axel")
    with caplog.at_level(logging.INFO, logger="app.auth"):
        iniciar_sesion(cliente_api, "axel", "otra-clave-larga")
        iniciar_sesion(cliente_api, "nadie", "otra-clave-larga")
    plantillas = {r.getMessage().replace("axel", "X").replace("nadie", "X") for r in caplog.records}
    assert plantillas == {"login fallido usuario='X'"}


def test_un_nombre_con_saltos_de_linea_no_inyecta_lineas_en_el_log(
    cliente_api: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.INFO, logger="app.auth"):
        iniciar_sesion(cliente_api, "axel\nlogin ok usuario='admin'", CLAVE)
    assert all("\n" not in mensaje for mensaje in _mensajes(caplog))
