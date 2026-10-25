from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from tests.fabricas import ClienteAutenticado, Red, amistad_aceptada, solicitud_pendiente

NO_ENCONTRADO = {"detail": "No encontrado"}
YA_HAY = {"detail": "Ya hay una solicitud o amistad con ese usuario"}


def _enviar(desde: ClienteAutenticado, hacia: object) -> Response:
    return desde.post("/api/amigos/solicitudes", json={"usuario_id": str(hacia)})


def _nombres(lista: list[dict[str, object]]) -> list[object]:
    return [x["nombre_usuario"] for x in lista]


def test_listar_las_tres_listas(red: Red) -> None:
    cuerpo = red.a.api.get("/api/amigos").json()
    assert set(cuerpo) == {"amigos", "recibidas", "enviadas"}
    assert _nombres(cuerpo["amigos"]) == ["usuario_b"]
    assert _nombres(cuerpo["recibidas"]) == ["usuario_c"]
    assert _nombres(cuerpo["enviadas"]) == ["usuario_d"]
    assert set(cuerpo["amigos"][0]) == {"id", "nombre_usuario", "desde"}
    assert set(cuerpo["recibidas"][0]) == {"id", "nombre_usuario", "creada_en"}
    assert cuerpo["amigos"][0]["id"] == str(red.b.id)


def test_listar_solo_las_propias(red: Red) -> None:
    amistad_aceptada(red.c, red.d)
    assert red.e.api.get("/api/amigos").json() == {"amigos": [], "recibidas": [], "enviadas": []}


def test_listar_ordena_por_nombre(red: Red) -> None:
    amistad_aceptada(red.e, red.a)
    assert _nombres(red.a.api.get("/api/amigos").json()["amigos"]) == ["usuario_b", "usuario_e"]


def test_listar_no_se_cachea_y_exige_token(red: Red, cliente_api: TestClient) -> None:
    assert red.a.api.get("/api/amigos").headers["Cache-Control"] == "no-store"
    assert cliente_api.get("/api/amigos").status_code == 401


def test_enviar_solicitud_nueva(red: Red) -> None:
    respuesta = _enviar(red.a.api, red.e.id)
    assert respuesta.status_code == 201
    assert respuesta.json() == {
        "id": str(red.e.id),
        "nombre_usuario": "usuario_e",
        "relacion": "solicitud_enviada",
    }
    assert _nombres(red.e.api.get("/api/amigos").json()["recibidas"]) == ["usuario_a"]


@pytest.mark.parametrize("cruzada", [False, True])
def test_solicitud_repetida_o_cruzada_responde_409_y_deja_una_fila(red: Red, cruzada: bool) -> None:
    primera = _enviar(red.a.api, red.e.id)
    assert primera.status_code == 201
    respuesta = _enviar(red.e.api if cruzada else red.a.api, red.a.id if cruzada else red.e.id)
    assert respuesta.status_code == 409
    assert respuesta.json() == YA_HAY
    assert (
        len(red.e.api.get("/api/amigos").json()["recibidas"])
        + len(red.e.api.get("/api/amigos").json()["enviadas"])
        == 1
    )


def test_solicitud_entre_amigos_responde_409(red: Red) -> None:
    assert _enviar(red.a.api, red.b.id).status_code == 409
    assert _enviar(red.b.api, red.a.id).status_code == 409


def test_destinatario_inexistente_responde_404(red: Red) -> None:
    respuesta = _enviar(red.a.api, uuid4())
    assert respuesta.status_code == 404
    assert respuesta.json() == NO_ENCONTRADO


def test_solicitud_a_uno_mismo_responde_422(red: Red) -> None:
    assert _enviar(red.a.api, red.a.id).status_code == 422


@pytest.mark.parametrize(
    "cuerpo", [{"usuario_id": "no-es-uuid"}, {"usuario_id": 5}, {}, {"usuario_id": None}]
)
def test_cuerpo_invalido_responde_422(red: Red, cuerpo: dict[str, object]) -> None:
    assert red.a.api.post("/api/amigos/solicitudes", json=cuerpo).status_code == 422


def test_campo_extra_responde_422(red: Red) -> None:
    respuesta = red.a.api.post(
        "/api/amigos/solicitudes", json={"usuario_id": str(red.e.id), "estado": "aceptada"}
    )
    assert respuesta.status_code == 422


def test_aceptar(red: Red) -> None:
    respuesta = red.a.api.post(f"/api/amigos/solicitudes/{red.c.id}/aceptar")
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "id": str(red.c.id),
        "nombre_usuario": "usuario_c",
        "relacion": "amigo",
    }
    assert "usuario_c" in _nombres(red.a.api.get("/api/amigos").json()["amigos"])
    assert "usuario_a" in _nombres(red.c.api.get("/api/amigos").json()["amigos"])


def test_el_solicitante_no_puede_aceptar_su_propia_solicitud(red: Red) -> None:
    respuesta = red.a.api.post(f"/api/amigos/solicitudes/{red.d.id}/aceptar")
    assert respuesta.status_code == 404
    assert respuesta.json() == NO_ENCONTRADO
    assert _nombres(red.a.api.get("/api/amigos").json()["enviadas"]) == ["usuario_d"]


def test_aceptar_sin_solicitud_o_ya_amigo_responde_404(red: Red) -> None:
    for otro in (red.e, red.b):
        respuesta = red.a.api.post(f"/api/amigos/solicitudes/{otro.id}/aceptar")
        assert respuesta.status_code == 404
        assert respuesta.json() == NO_ENCONTRADO


def test_aceptar_con_id_mal_formado_responde_422(red: Red) -> None:
    assert red.a.api.post("/api/amigos/solicitudes/no-es-uuid/aceptar").status_code == 422


def test_rechazar_una_solicitud_recibida(red: Red) -> None:
    respuesta = red.a.api.delete(f"/api/amigos/{red.c.id}")
    assert respuesta.status_code == 204
    assert respuesta.content == b""
    assert red.a.api.get("/api/amigos").json()["recibidas"] == []
    assert red.c.api.get("/api/amigos").json()["enviadas"] == []


def test_cancelar_una_solicitud_enviada(red: Red) -> None:
    assert red.a.api.delete(f"/api/amigos/{red.d.id}").status_code == 204
    assert red.d.api.get("/api/amigos").json()["recibidas"] == []


@pytest.mark.parametrize("quien", ["a", "b"])
def test_dejar_de_ser_amigos_por_cualquiera_de_los_dos(red: Red, quien: str) -> None:
    borra, otro = (red.a, red.b) if quien == "a" else (red.b, red.a)
    assert borra.api.delete(f"/api/amigos/{otro.id}").status_code == 204
    assert red.a.api.get("/api/amigos").json()["amigos"] == []
    assert red.b.api.get("/api/amigos").json()["amigos"] == []
    assert red.a.api.get(f"/api/amigos/{red.b.id}/teams").status_code == 404


def test_volver_a_pedir_tras_rechazar(red: Red) -> None:
    red.a.api.delete(f"/api/amigos/{red.c.id}")
    respuesta = _enviar(red.c.api, red.a.id)
    assert respuesta.status_code == 201


def test_eliminar_sin_amistad_responde_404(red: Red) -> None:
    respuesta = red.a.api.delete(f"/api/amigos/{red.e.id}")
    assert respuesta.status_code == 404
    assert respuesta.json() == NO_ENCONTRADO


def test_eliminar_con_id_mal_formado_responde_422(red: Red) -> None:
    assert red.a.api.delete("/api/amigos/no-es-uuid").status_code == 422


def test_una_sola_fila_por_par(red: Red, session_factory: sessionmaker[Session]) -> None:
    solicitud_pendiente(red.e, red.d)
    with UnitOfWork(session_factory) as uow:
        assert len(uow.amistades.listar_de(red.e.id)) == 1
    assert _enviar(red.d.api, red.e.id).status_code == 409
    with UnitOfWork(session_factory) as uow:
        assert len(uow.amistades.listar_de(red.e.id)) == 1


def test_todas_las_rutas_exigen_token(red: Red, cliente_api: TestClient) -> None:
    otro = str(uuid4())
    pedidos = [
        ("GET", "/api/amigos", None),
        ("POST", "/api/amigos/solicitudes", {"usuario_id": otro}),
        ("POST", f"/api/amigos/solicitudes/{otro}/aceptar", None),
        ("DELETE", f"/api/amigos/{otro}", None),
    ]
    for metodo, ruta, cuerpo in pedidos:
        sin_token = cliente_api.request(metodo, ruta, json=cuerpo)
        assert sin_token.status_code == 401
        assert sin_token.headers["WWW-Authenticate"] == "Bearer"


def test_las_respuestas_exitosas_no_se_cachean(red: Red) -> None:
    for respuesta in (
        red.a.api.get("/api/amigos"),
        _enviar(red.a.api, red.e.id),
        red.a.api.post(f"/api/amigos/solicitudes/{red.c.id}/aceptar"),
        red.a.api.delete(f"/api/amigos/{red.b.id}"),
    ):
        assert respuesta.status_code in (200, 201, 204)
        assert respuesta.headers["Cache-Control"] == "no-store"
