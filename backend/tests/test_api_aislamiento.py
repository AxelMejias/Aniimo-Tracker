from typing import Any
from uuid import uuid4

import pytest
from httpx import Response

from tests.fabricas import ClienteAutenticado, ficha_de_referencia
from tests.imagenes_de_prueba import PNG, WEBP

NO_ENCONTRADO = {"detail": "No encontrado"}

Pedido = tuple[str, str, dict[str, Any]]


def _pedidos(team_id: str) -> list[Pedido]:
    base = f"/api/teams/{team_id}"
    ficha = ficha_de_referencia()
    imagen = {"content": PNG, "headers": {"Content-Type": "image/png"}}
    return [
        ("PATCH", base, {"json": {"nombre": "Robado"}}),
        ("DELETE", base, {}),
        ("GET", f"{base}/aniimo/1", {}),
        ("PUT", f"{base}/aniimo/1", {"json": {**ficha, "nombre": "Robada"}}),
        ("DELETE", f"{base}/aniimo/1", {}),
        ("PUT", f"{base}/aniimo/1/imagen", imagen),
        ("GET", f"{base}/aniimo/1/imagen", {}),
        ("DELETE", f"{base}/aniimo/1/imagen", {}),
        ("GET", f"{base}/aniimo/2", {}),
        ("PUT", f"{base}/aniimo/2/imagen", imagen),
    ]


IDS = [
    "renombrar",
    "borrar_team",
    "leer_ficha",
    "guardar_ficha",
    "vaciar_slot",
    "guardar_imagen",
    "leer_imagen",
    "borrar_imagen",
    "leer_slot_vacio",
    "guardar_imagen_slot_vacio",
]


@pytest.fixture
def team_de_a(usuario_a: ClienteAutenticado) -> str:
    team_id: str = usuario_a.post("/api/teams", json={"nombre": "Privado"}).json()["id"]
    usuario_a.put(f"/api/teams/{team_id}/aniimo/1", json=ficha_de_referencia())
    usuario_a.put(
        f"/api/teams/{team_id}/aniimo/1/imagen",
        content=WEBP,
        headers={"Content-Type": "image/webp"},
    )
    return team_id


def _enviar(cliente: ClienteAutenticado, pedido: Pedido) -> Response:
    metodo, ruta, kwargs = pedido
    return cliente.request(metodo, ruta, **kwargs)


@pytest.mark.parametrize("indice", range(len(IDS)), ids=IDS)
def test_b_sobre_recursos_de_a_recibe_404_sin_modificar_nada(
    usuario_a: ClienteAutenticado,
    usuario_b: ClienteAutenticado,
    team_de_a: str,
    indice: int,
) -> None:
    respuesta = _enviar(usuario_b, _pedidos(team_de_a)[indice])
    assert respuesta.status_code == 404
    assert respuesta.json() == NO_ENCONTRADO
    [team] = usuario_a.get("/api/teams").json()["teams"]
    assert team["nombre"] == "Privado"
    assert team["slots"][0]["aniimo"]["nombre"] == "Irisalis"
    assert team["slots"][0]["aniimo"]["tiene_imagen"] is True
    imagen = usuario_a.get(f"/api/teams/{team_de_a}/aniimo/1/imagen")
    assert imagen.content == WEBP


@pytest.mark.parametrize("indice", range(len(IDS)), ids=IDS)
def test_team_ajeno_e_inexistente_son_indistinguibles(
    usuario_b: ClienteAutenticado, team_de_a: str, indice: int
) -> None:
    ajeno = _enviar(usuario_b, _pedidos(team_de_a)[indice])
    inexistente = _enviar(usuario_b, _pedidos(str(uuid4()))[indice])
    assert (ajeno.status_code, ajeno.headers.get("content-type"), ajeno.content) == (
        inexistente.status_code,
        inexistente.headers.get("content-type"),
        inexistente.content,
    )


def test_b_no_ve_los_teams_de_a_en_su_listado(
    usuario_b: ClienteAutenticado, team_de_a: str
) -> None:
    assert usuario_b.get("/api/teams").json() == {"teams": []}


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [
        ("PATCH", "/api/teams/no-es-un-uuid"),
        ("DELETE", "/api/teams/no-es-un-uuid"),
        ("GET", "/api/teams/123/aniimo/1"),
        ("PUT", "/api/teams/xyz/aniimo/1/imagen"),
    ],
)
def test_team_id_mal_formado_responde_422(
    usuario_a: ClienteAutenticado, metodo: str, ruta: str
) -> None:
    respuesta = usuario_a.request(metodo, ruta, json={"nombre": "x"} if metodo == "PATCH" else None)
    assert respuesta.status_code == 422


@pytest.mark.parametrize("slot", [0, 5, -1])
def test_slot_fuera_de_rango_responde_422(
    usuario_a: ClienteAutenticado, team_de_a: str, slot: int
) -> None:
    for metodo in ("GET", "DELETE"):
        assert usuario_a.request(metodo, f"/api/teams/{team_de_a}/aniimo/{slot}").status_code == 422
