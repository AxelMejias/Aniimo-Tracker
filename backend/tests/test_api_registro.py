from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from tests.fabricas import CLAVE, registrar


def _usuarios(session_factory: sessionmaker[Session]) -> int:
    with UnitOfWork(session_factory) as uow:
        return len(uow.usuarios.listar())


def test_registro_exitoso_devuelve_201_con_nombre_normalizado(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    respuesta = registrar(cliente_api, "Axel")
    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert set(cuerpo) == {"id", "nombre_usuario"}
    assert cuerpo["nombre_usuario"] == "axel"
    with UnitOfWork(session_factory) as uow:
        guardado = uow.usuarios.obtener_por_nombre_usuario("axel")
    assert str(guardado.id) == cuerpo["id"]
    assert guardado.password_hash != CLAVE
    assert guardado.password_hash.startswith("$argon2id$")


def test_el_cuerpo_del_registro_no_contiene_contrasena_ni_hash(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    respuesta = registrar(cliente_api, "axel")
    with UnitOfWork(session_factory) as uow:
        hash_guardado = uow.usuarios.obtener_por_nombre_usuario("axel").password_hash
    assert CLAVE not in respuesta.text
    assert hash_guardado not in respuesta.text
    assert "password" not in respuesta.text.lower()


@pytest.mark.parametrize("repetido", ["AXEL", "Axel", "axel"])
def test_nombre_repetido_responde_409(
    cliente_api: TestClient, session_factory: sessionmaker[Session], repetido: str
) -> None:
    registrar(cliente_api, "axel")
    respuesta = registrar(cliente_api, repetido)
    assert respuesta.status_code == 409
    assert respuesta.json() == {"detail": "El nombre de usuario no está disponible"}
    assert _usuarios(session_factory) == 1


@pytest.mark.parametrize(
    "nombre",
    ["axel mejías", "ax", "a" * 33, "", "axel-x", "axel\n", "axel@x", "ñandú", "axel "],
)
def test_nombre_invalido_responde_422_y_no_persiste(
    cliente_api: TestClient, session_factory: sessionmaker[Session], nombre: str
) -> None:
    assert registrar(cliente_api, nombre).status_code == 422
    assert _usuarios(session_factory) == 0


@pytest.mark.parametrize("nombre", ["abc", "a" * 32, "Ab_9", "___"])
def test_nombres_validos_en_los_limites_se_aceptan(cliente_api: TestClient, nombre: str) -> None:
    assert registrar(cliente_api, nombre).status_code == 201


@pytest.mark.parametrize("contrasena", ["a" * 11, "a" * 129, ""])
def test_contrasena_fuera_de_largo_responde_422(
    cliente_api: TestClient, session_factory: sessionmaker[Session], contrasena: str
) -> None:
    assert registrar(cliente_api, "axel", contrasena).status_code == 422
    assert _usuarios(session_factory) == 0


@pytest.mark.parametrize("contrasena", ["a" * 12, "a" * 128, "sin mayusculas ni numeros"])
def test_contrasenas_validas_sin_reglas_de_composicion(
    cliente_api: TestClient, contrasena: str
) -> None:
    assert registrar(cliente_api, "axel", contrasena).status_code == 201


def test_campo_extra_responde_422(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    respuesta = cliente_api.post(
        "/api/auth/register",
        json={"nombre_usuario": "axel", "contrasena": CLAVE, "es_admin": True},
    )
    assert respuesta.status_code == 422
    assert _usuarios(session_factory) == 0


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"nombre_usuario": 42, "contrasena": CLAVE},
        {"nombre_usuario": "axel", "contrasena": 123456789012},
        {"nombre_usuario": None, "contrasena": CLAVE},
        {"nombre_usuario": ["axel"], "contrasena": CLAVE},
        {"nombre_usuario": "axel"},
        {"contrasena": CLAVE},
        {},
    ],
)
def test_tipos_no_string_o_campos_faltantes_responden_422(
    cliente_api: TestClient, cuerpo: dict[str, Any]
) -> None:
    assert cliente_api.post("/api/auth/register", json=cuerpo).status_code == 422
