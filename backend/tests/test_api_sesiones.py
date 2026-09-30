import pytest
from fastapi.testclient import TestClient

from tests.fabricas import RelojFalso, con_token, registrar, token_de

NO_AUTENTICADO = {"detail": "No autenticado"}


def _token_de_axel(cliente_api: TestClient) -> str:
    registrar(cliente_api)
    return token_de(cliente_api)


def test_me_con_token_devuelve_solo_el_nombre(cliente_api: TestClient) -> None:
    token = _token_de_axel(cliente_api)
    respuesta = cliente_api.get("/api/auth/me", headers=con_token(token))
    assert respuesta.status_code == 200
    assert respuesta.json() == {"nombre_usuario": "axel"}


@pytest.mark.parametrize(
    "cabeceras",
    [
        {},
        {"Authorization": "Basic YXhlbDp4"},
        {"Authorization": "Bearer token-inventado"},
        {"Authorization": "Bearer "},
        {"Authorization": "Bearer"},
        {"Authorization": "token-suelto"},
    ],
)
def test_me_sin_credenciales_validas_responde_el_mismo_401(
    cliente_api: TestClient, cabeceras: dict[str, str]
) -> None:
    _token_de_axel(cliente_api)
    respuesta = cliente_api.get("/api/auth/me", headers=cabeceras)
    assert respuesta.status_code == 401
    assert respuesta.json() == NO_AUTENTICADO
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_token_vencido_por_inactividad_responde_401(
    cliente_api: TestClient, reloj: RelojFalso
) -> None:
    token = _token_de_axel(cliente_api)
    reloj.avanzar(minutes=31)
    respuesta = cliente_api.get("/api/auth/me", headers=con_token(token))
    assert respuesta.status_code == 401
    assert respuesta.json() == NO_AUTENTICADO
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_el_uso_renueva_la_inactividad(cliente_api: TestClient, reloj: RelojFalso) -> None:
    token = _token_de_axel(cliente_api)
    reloj.avanzar(minutes=20)
    assert cliente_api.get("/api/auth/me", headers=con_token(token)).status_code == 200
    reloj.avanzar(minutes=20)
    assert cliente_api.get("/api/auth/me", headers=con_token(token)).status_code == 200


def test_token_vencido_por_tope_absoluto_responde_401(
    cliente_api: TestClient, reloj: RelojFalso
) -> None:
    token = _token_de_axel(cliente_api)
    for _ in range(71):
        reloj.avanzar(minutes=10)
        assert cliente_api.get("/api/auth/me", headers=con_token(token)).status_code == 200
    reloj.avanzar(minutes=10)
    respuesta = cliente_api.get("/api/auth/me", headers=con_token(token))
    assert respuesta.status_code == 401
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_logout_revoca_el_token(cliente_api: TestClient) -> None:
    token = _token_de_axel(cliente_api)
    assert cliente_api.post("/api/auth/logout", headers=con_token(token)).status_code == 204
    respuesta = cliente_api.get("/api/auth/me", headers=con_token(token))
    assert respuesta.status_code == 401
    assert respuesta.json() == NO_AUTENTICADO
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_logout_deja_activas_las_otras_sesiones(cliente_api: TestClient) -> None:
    uno = _token_de_axel(cliente_api)
    otro = token_de(cliente_api)
    cliente_api.post("/api/auth/logout", headers=con_token(uno))
    assert cliente_api.get("/api/auth/me", headers=con_token(otro)).status_code == 200


def test_logout_sin_token_responde_401(cliente_api: TestClient) -> None:
    respuesta = cliente_api.post("/api/auth/logout")
    assert respuesta.status_code == 401
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_logout_devuelve_cuerpo_vacio(cliente_api: TestClient) -> None:
    token = _token_de_axel(cliente_api)
    assert cliente_api.post("/api/auth/logout", headers=con_token(token)).content == b""


def test_health_sigue_publico(cliente_api: TestClient) -> None:
    assert cliente_api.get("/api/health").status_code == 200
