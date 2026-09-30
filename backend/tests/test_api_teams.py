from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.fabricas import ClienteAutenticado, RelojFalso, ficha_de_referencia
from tests.imagenes_de_prueba import WEBP

MAXIMO = {"detail": "Ya tenés el máximo de 4 teams"}


def _crear(cliente: ClienteAutenticado, nombre: str = "Team") -> dict[str, Any]:
    respuesta = cliente.post("/api/teams", json={"nombre": nombre})
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def _listar(cliente: ClienteAutenticado) -> list[dict[str, Any]]:
    respuesta = cliente.get("/api/teams")
    assert respuesta.status_code == 200
    return respuesta.json()["teams"]


def _guardar_ficha(
    cliente: ClienteAutenticado, team_id: str, slot: int, **cambios: object
) -> dict[str, Any]:
    ficha = {**ficha_de_referencia(), **cambios}
    respuesta = cliente.put(f"/api/teams/{team_id}/aniimo/{slot}", json=ficha)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()["aniimo"]


def test_listado_vacio(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.get("/api/teams")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"teams": []}


def test_listado_con_slots_ocupados_y_vacios(usuario_a: ClienteAutenticado) -> None:
    team = _crear(usuario_a, "Principal")
    _guardar_ficha(usuario_a, team["id"], 1)
    _guardar_ficha(usuario_a, team["id"], 3, nombre="Otro")
    [listado] = _listar(usuario_a)
    assert listado["id"] == team["id"]
    assert [(s["slot"], s["aniimo"] is None) for s in listado["slots"]] == [
        (1, False),
        (2, True),
        (3, False),
        (4, True),
    ]


def test_el_resumen_de_la_tarjeta_es_exacto(usuario_a: ClienteAutenticado) -> None:
    team = _crear(usuario_a, "Principal")
    _guardar_ficha(usuario_a, team["id"], 1)
    respuesta = usuario_a.put(
        f"/api/teams/{team['id']}/aniimo/1/imagen",
        content=WEBP,
        headers={"Content-Type": "image/webp"},
    )
    assert respuesta.status_code == 204
    [listado] = _listar(usuario_a)
    assert listado["slots"][0]["aniimo"] == {
        "nombre": "Irisalis",
        "nivel": 60,
        "cp": 3475,
        "personalidad": "ENFJ",
        "estrella_actual": 2,
        "despertares_usados": 28,
        "despertares_total": 43,
        "tiene_imagen": True,
    }


def test_el_listado_no_incluye_ids_de_usuario(usuario_a: ClienteAutenticado) -> None:
    _crear(usuario_a)
    [listado] = _listar(usuario_a)
    assert set(listado) == {"id", "nombre", "orden", "slots"}


def test_el_listado_solo_trae_los_teams_propios(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    propios = {_crear(usuario_a, "A1")["id"], _crear(usuario_a, "A2")["id"]}
    _crear(usuario_b, "B1")
    _crear(usuario_b, "B2")
    assert {t["id"] for t in _listar(usuario_a)} == propios


def test_listado_sin_token_responde_401(cliente_api: TestClient) -> None:
    respuesta = cliente_api.get("/api/teams")
    assert respuesta.status_code == 401
    assert respuesta.json() == {"detail": "No autenticado"}


def test_listado_con_token_vencido_responde_401(
    usuario_a: ClienteAutenticado, reloj: RelojFalso
) -> None:
    reloj.avanzar(minutes=31)
    respuesta = usuario_a.get("/api/teams")
    assert respuesta.status_code == 401
    assert respuesta.headers["www-authenticate"] == "Bearer"


def test_crear_el_primer_team(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.post("/api/teams", json={"nombre": "Team 1"})
    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert (cuerpo["nombre"], cuerpo["orden"]) == ("Team 1", 1)
    assert cuerpo["slots"] == [{"slot": n, "aniimo": None} for n in (1, 2, 3, 4)]


def test_crear_reutiliza_la_posicion_libre(usuario_a: ClienteAutenticado) -> None:
    teams = [_crear(usuario_a, f"T{n}") for n in (1, 2, 3)]
    assert usuario_a.delete(f"/api/teams/{teams[1]['id']}").status_code == 204
    assert _crear(usuario_a, "Nuevo")["orden"] == 2


def test_quinto_team_responde_409_con_el_mensaje(usuario_a: ClienteAutenticado) -> None:
    for n in range(4):
        _crear(usuario_a, f"T{n}")
    respuesta = usuario_a.post("/api/teams", json={"nombre": "Otro"})
    assert respuesta.status_code == 409
    assert respuesta.json() == MAXIMO
    assert len(_listar(usuario_a)) == 4


def test_el_limite_de_teams_es_por_usuario(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    for n in range(4):
        _crear(usuario_a, f"T{n}")
    assert usuario_b.post("/api/teams", json={"nombre": "Mio"}).status_code == 201


@pytest.mark.parametrize("nombre", ["   ", "", "x" * 51])
def test_nombre_de_team_invalido_responde_422_y_no_crea(
    usuario_a: ClienteAutenticado, nombre: str
) -> None:
    respuesta = usuario_a.post("/api/teams", json={"nombre": nombre})
    assert respuesta.status_code == 422
    assert _listar(usuario_a) == []


@pytest.mark.parametrize("nombre", ["Team", "x" * 50])
def test_nombres_validos_en_el_borde_se_aceptan(usuario_a: ClienteAutenticado, nombre: str) -> None:
    assert usuario_a.post("/api/teams", json={"nombre": nombre}).status_code == 201


@pytest.mark.parametrize(
    "cuerpo",
    [{"nombre": "Team 1", "orden": 3}, {"nombre": 5}, {}, {"nombre": None}],
    ids=["campo_extra", "no_string", "sin_nombre", "nulo"],
)
def test_crear_team_rechaza_cuerpos_mal_formados(
    usuario_a: ClienteAutenticado, cuerpo: dict[str, Any]
) -> None:
    assert usuario_a.post("/api/teams", json=cuerpo).status_code == 422


def test_el_nombre_del_team_se_recorta(usuario_a: ClienteAutenticado) -> None:
    assert _crear(usuario_a, "  Principal  ")["nombre"] == "Principal"


def test_renombrar_conserva_orden_y_slots(usuario_a: ClienteAutenticado) -> None:
    team = _crear(usuario_a, "Viejo")
    _guardar_ficha(usuario_a, team["id"], 1)
    respuesta = usuario_a.patch(f"/api/teams/{team['id']}", json={"nombre": "Raid"})
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert (cuerpo["nombre"], cuerpo["orden"]) == ("Raid", team["orden"])
    assert cuerpo["slots"][0]["aniimo"]["nombre"] == "Irisalis"


@pytest.mark.parametrize("cuerpo", [{"nombre": ""}, {"nombre": "  "}, {"nombre": "x" * 51}, {}])
def test_renombrar_con_nombre_invalido_responde_422_y_no_cambia(
    usuario_a: ClienteAutenticado, cuerpo: dict[str, Any]
) -> None:
    team = _crear(usuario_a, "Viejo")
    assert usuario_a.patch(f"/api/teams/{team['id']}", json=cuerpo).status_code == 422
    assert _listar(usuario_a)[0]["nombre"] == "Viejo"


def test_borrar_un_team_con_aniimo_e_imagen(usuario_a: ClienteAutenticado) -> None:
    team = _crear(usuario_a)
    _guardar_ficha(usuario_a, team["id"], 1)
    _guardar_ficha(usuario_a, team["id"], 2, nombre="Dos")
    usuario_a.put(
        f"/api/teams/{team['id']}/aniimo/1/imagen",
        content=WEBP,
        headers={"Content-Type": "image/webp"},
    )
    respuesta = usuario_a.delete(f"/api/teams/{team['id']}")
    assert respuesta.status_code == 204
    assert respuesta.content == b""
    assert _listar(usuario_a) == []
    assert usuario_a.get(f"/api/teams/{team['id']}/aniimo/1").status_code == 404


def test_borrar_un_team_no_toca_a_los_demas(usuario_a: ClienteAutenticado) -> None:
    teams = [_crear(usuario_a, f"T{n}") for n in (1, 2, 3)]
    _guardar_ficha(usuario_a, teams[0]["id"], 1)
    _guardar_ficha(usuario_a, teams[2]["id"], 4, nombre="Cuatro")
    usuario_a.delete(f"/api/teams/{teams[1]['id']}")
    restantes = _listar(usuario_a)
    assert [(t["nombre"], t["orden"]) for t in restantes] == [("T1", 1), ("T3", 3)]
    assert restantes[0]["slots"][0]["aniimo"]["nombre"] == "Irisalis"
    assert restantes[1]["slots"][3]["aniimo"]["nombre"] == "Cuatro"


def test_las_respuestas_de_teams_no_se_cachean(usuario_a: ClienteAutenticado) -> None:
    team = _crear(usuario_a)
    for respuesta in (
        usuario_a.get("/api/teams"),
        usuario_a.post("/api/teams", json={"nombre": "Otro"}),
        usuario_a.patch(f"/api/teams/{team['id']}", json={"nombre": "Raid"}),
    ):
        assert respuesta.headers["cache-control"] == "no-store"
