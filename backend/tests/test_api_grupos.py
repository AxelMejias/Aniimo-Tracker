from dataclasses import replace
from typing import Any
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from tests.fabricas import ClienteAutenticado

MAXIMO_DE_GRUPOS = {"detail": "Ya tenés el máximo de 4 grupos"}


def _crear_team(cliente: ClienteAutenticado, nombre: str = "Team") -> dict[str, Any]:
    respuesta = cliente.post("/api/teams", json={"nombre": nombre})
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def _crear_grupo(cliente: ClienteAutenticado, nombre: str = "Buildeado") -> dict[str, Any]:
    respuesta = cliente.post("/api/grupos", json={"nombre": nombre})
    assert respuesta.status_code == 201, respuesta.text
    cuerpo = respuesta.json()
    return max(cuerpo["grupos"], key=lambda g: g["orden"] if g["nombre"] == nombre else -1)


def _poner_en_grupo(
    session_factory: sessionmaker[Session], team_id: str, grupo_id: str | None
) -> None:
    with UnitOfWork(session_factory) as uow:
        team = uow.teams.obtener(UUID(team_id))
        assert team is not None
        uow.teams.actualizar(replace(team, grupo_id=None if grupo_id is None else UUID(grupo_id)))
        uow.commit()


def _lista(cliente: ClienteAutenticado) -> dict[str, Any]:
    respuesta = cliente.get("/api/teams")
    assert respuesta.status_code == 200
    return respuesta.json()


def test_el_primer_grupo_nace_vacio_en_la_posicion_1(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.post("/api/grupos", json={"nombre": "Buildeado"})
    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["teams"] == []
    [grupo] = cuerpo["grupos"]
    assert grupo == {
        "id": grupo["id"],
        "nombre": "Buildeado",
        "orden": 1,
        "team_ids": [],
        "portada_team_id": None,
        "portada_efectiva_team_id": None,
    }


def test_el_quinto_grupo_responde_409_y_no_crea_nada(usuario_a: ClienteAutenticado) -> None:
    for n in range(4):
        _crear_grupo(usuario_a, f"G{n}")
    respuesta = usuario_a.post("/api/grupos", json={"nombre": "Otro"})
    assert respuesta.status_code == 409
    assert respuesta.json() == MAXIMO_DE_GRUPOS
    assert len(_lista(usuario_a)["grupos"]) == 4


def test_el_limite_de_grupos_es_por_usuario(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    for n in range(4):
        _crear_grupo(usuario_a, f"G{n}")
    assert usuario_b.post("/api/grupos", json={"nombre": "Mio"}).status_code == 201


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"nombre": "   "},
        {"nombre": ""},
        {"nombre": "x" * 51},
        {"nombre": "G", "orden": 1},
        {"nombre": 123},
        {},
        {"nombre": None},
    ],
)
def test_crear_grupo_con_cuerpo_invalido_responde_422_sin_crear(
    usuario_a: ClienteAutenticado, cuerpo: dict[str, Any]
) -> None:
    assert usuario_a.post("/api/grupos", json=cuerpo).status_code == 422
    assert _lista(usuario_a)["grupos"] == []


def test_los_nombres_en_el_borde_se_aceptan(usuario_a: ClienteAutenticado) -> None:
    assert usuario_a.post("/api/grupos", json={"nombre": "x"}).status_code == 201
    assert usuario_a.post("/api/grupos", json={"nombre": "y" * 50}).status_code == 201


def test_el_nombre_se_recorta_y_puede_repetirse(usuario_a: ClienteAutenticado) -> None:
    _crear_grupo(usuario_a, "Homeland")
    respuesta = usuario_a.post("/api/grupos", json={"nombre": "  Homeland  "})
    assert respuesta.status_code == 201
    assert [g["nombre"] for g in respuesta.json()["grupos"]] == ["Homeland", "Homeland"]


def test_crear_grupo_sin_token_responde_401(cliente_api: TestClient) -> None:
    respuesta = cliente_api.post("/api/grupos", json={"nombre": "Buildeado"})
    assert respuesta.status_code == 401
    assert respuesta.json() == {"detail": "No autenticado"}


def test_crear_grupo_no_se_cachea(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.post("/api/grupos", json={"nombre": "Buildeado"})
    assert respuesta.headers["Cache-Control"] == "no-store"


def test_crear_reutiliza_la_posicion_libre(usuario_a: ClienteAutenticado) -> None:
    grupos = [_crear_grupo(usuario_a, f"G{n}") for n in (1, 2, 3)]
    assert usuario_a.delete(f"/api/grupos/{grupos[1]['id']}").status_code == 204
    assert _crear_grupo(usuario_a, "Nuevo")["orden"] == 2


def test_renombrar_un_grupo_conserva_sus_teams(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session]
) -> None:
    grupo = _crear_grupo(usuario_a)
    team = _crear_team(usuario_a)
    _poner_en_grupo(session_factory, team["id"], grupo["id"])
    respuesta = usuario_a.patch(f"/api/grupos/{grupo['id']}", json={"nombre": "Homeland"})
    assert respuesta.status_code == 200
    [resultado] = respuesta.json()["grupos"]
    assert (resultado["nombre"], resultado["team_ids"]) == ("Homeland", [team["id"]])


def test_elegir_la_portada_del_grupo(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session]
) -> None:
    grupo = _crear_grupo(usuario_a)
    pruebas, hielo = _crear_team(usuario_a, "Pruebas"), _crear_team(usuario_a, "Hielo")
    for team in (pruebas, hielo):
        _poner_en_grupo(session_factory, team["id"], grupo["id"])
    respuesta = usuario_a.patch(f"/api/grupos/{grupo['id']}", json={"portada_team_id": hielo["id"]})
    assert respuesta.status_code == 200
    [resultado] = respuesta.json()["grupos"]
    assert resultado["portada_team_id"] == hielo["id"]
    assert resultado["portada_efectiva_team_id"] == hielo["id"]


def test_volver_a_la_portada_automatica(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session]
) -> None:
    grupo = _crear_grupo(usuario_a)
    primero, segundo = _crear_team(usuario_a, "Uno"), _crear_team(usuario_a, "Dos")
    for team in (primero, segundo):
        _poner_en_grupo(session_factory, team["id"], grupo["id"])
    usuario_a.patch(f"/api/grupos/{grupo['id']}", json={"portada_team_id": segundo["id"]})
    respuesta = usuario_a.patch(f"/api/grupos/{grupo['id']}", json={"portada_team_id": None})
    assert respuesta.status_code == 200
    [resultado] = respuesta.json()["grupos"]
    assert resultado["portada_team_id"] is None
    assert resultado["portada_efectiva_team_id"] == primero["id"]


def test_nombre_y_portada_juntos(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session]
) -> None:
    grupo = _crear_grupo(usuario_a)
    team = _crear_team(usuario_a)
    _poner_en_grupo(session_factory, team["id"], grupo["id"])
    respuesta = usuario_a.patch(
        f"/api/grupos/{grupo['id']}", json={"nombre": "Nuevo", "portada_team_id": team["id"]}
    )
    [resultado] = respuesta.json()["grupos"]
    assert (resultado["nombre"], resultado["portada_team_id"]) == ("Nuevo", team["id"])


def test_portada_fuera_del_grupo_responde_422_y_no_cambia(
    usuario_a: ClienteAutenticado,
    usuario_b: ClienteAutenticado,
    session_factory: sessionmaker[Session],
) -> None:
    grupo, otro_grupo = _crear_grupo(usuario_a, "Uno"), _crear_grupo(usuario_a, "Dos")
    suelto, en_otro = _crear_team(usuario_a, "Suelto"), _crear_team(usuario_a, "Otro")
    _poner_en_grupo(session_factory, en_otro["id"], otro_grupo["id"])
    ajeno = _crear_team(usuario_b, "Ajeno")
    for team_id in (suelto["id"], en_otro["id"], ajeno["id"], str(uuid4())):
        respuesta = usuario_a.patch(f"/api/grupos/{grupo['id']}", json={"portada_team_id": team_id})
        assert respuesta.status_code == 422
    grupos = {g["id"]: g for g in _lista(usuario_a)["grupos"]}
    assert grupos[grupo["id"]]["portada_team_id"] is None


@pytest.mark.parametrize(
    "cuerpo",
    [
        {},
        {"nombre": None},
        {"nombre": "   "},
        {"nombre": "x" * 51},
        {"nombre": 5},
        {"portada_team_id": 5},
        {"portada_team_id": "no-es-uuid"},
        {"orden": 2},
        {"nombre": "Nuevo", "usuario_id": "x"},
    ],
)
def test_editar_grupo_con_cuerpo_invalido_responde_422_y_no_cambia(
    usuario_a: ClienteAutenticado, cuerpo: dict[str, Any]
) -> None:
    grupo = _crear_grupo(usuario_a)
    assert usuario_a.patch(f"/api/grupos/{grupo['id']}", json=cuerpo).status_code == 422
    assert _lista(usuario_a)["grupos"][0]["nombre"] == "Buildeado"


def test_borrar_el_grupo_deja_sus_teams_sueltos(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session]
) -> None:
    grupo = _crear_grupo(usuario_a)
    teams = [_crear_team(usuario_a, f"T{n}") for n in (1, 2)]
    for team in teams:
        _poner_en_grupo(session_factory, team["id"], grupo["id"])
    respuesta = usuario_a.delete(f"/api/grupos/{grupo['id']}")
    assert respuesta.status_code == 204
    lista = _lista(usuario_a)
    assert lista["grupos"] == []
    assert [(t["id"], t["grupo_id"]) for t in lista["teams"]] == [(t["id"], None) for t in teams]


def test_borrar_un_grupo_no_toca_a_los_demas(usuario_a: ClienteAutenticado) -> None:
    uno, dos = _crear_grupo(usuario_a, "Uno"), _crear_grupo(usuario_a, "Dos")
    usuario_a.delete(f"/api/grupos/{uno['id']}")
    assert [g["id"] for g in _lista(usuario_a)["grupos"]] == [dos["id"]]


def _agregar(cliente: ClienteAutenticado, grupo: dict[str, Any], team: dict[str, Any]) -> Response:
    return cliente.put(f"/api/grupos/{grupo['id']}/teams/{team['id']}")


def _grupo_en(cliente: ClienteAutenticado, grupo_id: str) -> dict[str, Any]:
    return next(g for g in _lista(cliente)["grupos"] if g["id"] == grupo_id)


def test_agregar_un_team_suelto_lo_pone_en_el_grupo_en_orden_de_team(
    usuario_a: ClienteAutenticado,
) -> None:
    grupo = _crear_grupo(usuario_a)
    uno, dos, tres = (_crear_team(usuario_a, f"T{n}") for n in (1, 2, 3))
    _agregar(usuario_a, grupo, tres)
    _agregar(usuario_a, grupo, uno)
    respuesta = _agregar(usuario_a, grupo, dos)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["grupos"][0]["team_ids"] == [uno["id"], dos["id"], tres["id"]]
    assert {t["id"]: t["grupo_id"] for t in cuerpo["teams"]}[dos["id"]] == grupo["id"]


def test_agregar_un_team_que_ya_esta_es_idempotente(usuario_a: ClienteAutenticado) -> None:
    grupo = _crear_grupo(usuario_a)
    team = _crear_team(usuario_a)
    primera = _agregar(usuario_a, grupo, team)
    segunda = _agregar(usuario_a, grupo, team)
    assert segunda.status_code == 200
    assert segunda.json() == primera.json()


def test_mover_el_team_de_portada_limpia_la_portada_del_grupo_anterior(
    usuario_a: ClienteAutenticado,
) -> None:
    origen, destino = _crear_grupo(usuario_a, "Buildeado"), _crear_grupo(usuario_a, "En proceso")
    raid, otro = _crear_team(usuario_a, "Raid"), _crear_team(usuario_a, "Otro")
    _agregar(usuario_a, origen, raid)
    _agregar(usuario_a, origen, otro)
    usuario_a.patch(f"/api/grupos/{origen['id']}", json={"portada_team_id": raid["id"]})
    respuesta = _agregar(usuario_a, destino, raid)
    assert respuesta.status_code == 200
    grupos = {g["id"]: g for g in respuesta.json()["grupos"]}
    assert grupos[destino["id"]]["team_ids"] == [raid["id"]]
    assert grupos[origen["id"]]["team_ids"] == [otro["id"]]
    assert grupos[origen["id"]]["portada_team_id"] is None


def test_mover_otro_team_no_toca_la_portada_del_grupo_anterior(
    usuario_a: ClienteAutenticado,
) -> None:
    origen, destino = _crear_grupo(usuario_a, "Uno"), _crear_grupo(usuario_a, "Dos")
    portada, otro = _crear_team(usuario_a, "Portada"), _crear_team(usuario_a, "Otro")
    _agregar(usuario_a, origen, portada)
    _agregar(usuario_a, origen, otro)
    usuario_a.patch(f"/api/grupos/{origen['id']}", json={"portada_team_id": portada["id"]})
    _agregar(usuario_a, destino, otro)
    assert _grupo_en(usuario_a, origen["id"])["portada_team_id"] == portada["id"]


def test_el_sexto_team_responde_409_y_no_cambia_nada(usuario_a: ClienteAutenticado) -> None:
    grupo = _crear_grupo(usuario_a)
    for n in range(5):
        _agregar(usuario_a, grupo, _crear_team(usuario_a, f"T{n}"))
    sexto = _crear_team(usuario_a, "Sexto")
    respuesta = _agregar(usuario_a, grupo, sexto)
    assert respuesta.status_code == 409
    assert respuesta.json() == {"detail": "Ese grupo ya tiene el máximo de 5 teams"}
    assert len(_grupo_en(usuario_a, grupo["id"])["team_ids"]) == 5
    sexto_ahora = next(t for t in _lista(usuario_a)["teams"] if t["id"] == sexto["id"])
    assert sexto_ahora["grupo_id"] is None


def test_mover_a_un_grupo_lleno_deja_al_team_en_su_grupo(usuario_a: ClienteAutenticado) -> None:
    lleno, origen = _crear_grupo(usuario_a, "Lleno"), _crear_grupo(usuario_a, "Origen")
    for n in range(5):
        _agregar(usuario_a, lleno, _crear_team(usuario_a, f"L{n}"))
    viajero = _crear_team(usuario_a, "Viajero")
    _agregar(usuario_a, origen, viajero)
    assert _agregar(usuario_a, lleno, viajero).status_code == 409
    assert _grupo_en(usuario_a, origen["id"])["team_ids"] == [viajero["id"]]


def test_agregar_a_un_grupo_lleno_un_team_que_ya_esta_sigue_siendo_idempotente(
    usuario_a: ClienteAutenticado,
) -> None:
    grupo = _crear_grupo(usuario_a)
    teams = [_crear_team(usuario_a, f"T{n}") for n in range(5)]
    for team in teams:
        _agregar(usuario_a, grupo, team)
    assert _agregar(usuario_a, grupo, teams[2]).status_code == 200


def test_sacar_un_team_lo_deja_suelto(usuario_a: ClienteAutenticado) -> None:
    grupo = _crear_grupo(usuario_a)
    team = _crear_team(usuario_a)
    _agregar(usuario_a, grupo, team)
    respuesta = usuario_a.delete(f"/api/grupos/{grupo['id']}/teams/{team['id']}")
    assert respuesta.status_code == 204
    assert _grupo_en(usuario_a, grupo["id"])["team_ids"] == []
    assert _lista(usuario_a)["teams"][0]["grupo_id"] is None


def test_sacar_un_team_suelto_de_un_grupo_responde_404(usuario_a: ClienteAutenticado) -> None:
    grupo = _crear_grupo(usuario_a)
    suelto = _crear_team(usuario_a)
    respuesta = usuario_a.delete(f"/api/grupos/{grupo['id']}/teams/{suelto['id']}")
    assert respuesta.status_code == 404
    assert respuesta.json() == {"detail": "No encontrado"}


def test_sacar_un_team_de_otro_grupo_responde_404_y_no_lo_mueve(
    usuario_a: ClienteAutenticado,
) -> None:
    uno, dos = _crear_grupo(usuario_a, "Uno"), _crear_grupo(usuario_a, "Dos")
    team = _crear_team(usuario_a)
    _agregar(usuario_a, uno, team)
    assert usuario_a.delete(f"/api/grupos/{dos['id']}/teams/{team['id']}").status_code == 404
    assert _grupo_en(usuario_a, uno["id"])["team_ids"] == [team["id"]]


def test_sacar_el_team_de_portada_la_limpia(usuario_a: ClienteAutenticado) -> None:
    grupo = _crear_grupo(usuario_a)
    portada, otro = _crear_team(usuario_a, "Portada"), _crear_team(usuario_a, "Otro")
    _agregar(usuario_a, grupo, portada)
    _agregar(usuario_a, grupo, otro)
    usuario_a.patch(f"/api/grupos/{grupo['id']}", json={"portada_team_id": portada["id"]})
    usuario_a.delete(f"/api/grupos/{grupo['id']}/teams/{portada['id']}")
    resultado = _grupo_en(usuario_a, grupo["id"])
    assert resultado["portada_team_id"] is None
    assert resultado["portada_efectiva_team_id"] == otro["id"]


RUTAS_CON_GRUPO: list[tuple[str, str, dict[str, Any] | None]] = [
    ("PATCH", "/api/grupos/{g}", {"nombre": "Robado"}),
    ("DELETE", "/api/grupos/{g}", None),
    ("PUT", "/api/grupos/{g}/teams/{t}", None),
    ("DELETE", "/api/grupos/{g}/teams/{t}", None),
]


@pytest.mark.parametrize(
    ("metodo", "ruta", "cuerpo"), RUTAS_CON_GRUPO, ids=lambda v: v if isinstance(v, str) else ""
)
def test_un_grupo_ajeno_y_uno_inexistente_responden_el_mismo_404(
    usuario_a: ClienteAutenticado,
    usuario_b: ClienteAutenticado,
    metodo: str,
    ruta: str,
    cuerpo: dict[str, Any] | None,
) -> None:
    grupo_de_a = _crear_grupo(usuario_a, "De A")
    team_de_b = _crear_team(usuario_b, "De B")
    ajeno = usuario_b.request(
        metodo, ruta.format(g=grupo_de_a["id"], t=team_de_b["id"]), json=cuerpo
    )
    inexistente = usuario_b.request(metodo, ruta.format(g=uuid4(), t=team_de_b["id"]), json=cuerpo)
    assert ajeno.status_code == inexistente.status_code == 404
    assert ajeno.json() == inexistente.json() == {"detail": "No encontrado"}
    [grupo] = _lista(usuario_a)["grupos"]
    assert (grupo["nombre"], grupo["team_ids"]) == ("De A", [])


@pytest.mark.parametrize("metodo", ["PUT", "DELETE"])
def test_un_team_ajeno_y_uno_inexistente_responden_el_mismo_404(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado, metodo: str
) -> None:
    grupo_de_b = _crear_grupo(usuario_b)
    team_de_a = _crear_team(usuario_a, "De A")
    ajeno = usuario_b.request(metodo, f"/api/grupos/{grupo_de_b['id']}/teams/{team_de_a['id']}")
    inexistente = usuario_b.request(metodo, f"/api/grupos/{grupo_de_b['id']}/teams/{uuid4()}")
    assert ajeno.status_code == inexistente.status_code == 404
    assert ajeno.json() == inexistente.json() == {"detail": "No encontrado"}
    assert _lista(usuario_a)["teams"][0]["grupo_id"] is None
    assert _lista(usuario_b)["grupos"][0]["team_ids"] == []


def test_poner_un_team_propio_en_un_grupo_ajeno_responde_404(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    grupo_de_a = _crear_grupo(usuario_a)
    team_de_b = _crear_team(usuario_b)
    assert _agregar(usuario_b, grupo_de_a, team_de_b).status_code == 404
    assert _lista(usuario_b)["teams"][0]["grupo_id"] is None


@pytest.mark.parametrize(
    ("metodo", "ruta", "cuerpo"),
    [
        ("PATCH", "/api/grupos/no-es-uuid", {"nombre": "X"}),
        ("DELETE", "/api/grupos/no-es-uuid", None),
        ("PUT", "/api/grupos/no-es-uuid/teams/no-es-uuid", None),
        ("PUT", "/api/grupos/{g}/teams/no-es-uuid", None),
        ("DELETE", "/api/grupos/no-es-uuid/teams/{t}", None),
        ("DELETE", "/api/grupos/{g}/teams/no-es-uuid", None),
    ],
)
def test_un_id_que_no_es_uuid_responde_422(
    usuario_a: ClienteAutenticado, metodo: str, ruta: str, cuerpo: dict[str, Any] | None
) -> None:
    grupo, team = _crear_grupo(usuario_a), _crear_team(usuario_a)
    respuesta = usuario_a.request(metodo, ruta.format(g=grupo["id"], t=team["id"]), json=cuerpo)
    assert respuesta.status_code == 422


DESACTUALIZADO = {"detail": "El orden cambió; recargá e intentá de nuevo"}


def _ordenes_de_grupos(cliente: ClienteAutenticado) -> list[tuple[str, int]]:
    return [(g["nombre"], g["orden"]) for g in _lista(cliente)["grupos"]]


def test_reordenar_los_grupos(usuario_a: ClienteAutenticado) -> None:
    buildeado, proceso, homeland = (
        _crear_grupo(usuario_a, nombre) for nombre in ("Buildeado", "En proceso", "Homeland")
    )
    respuesta = usuario_a.put(
        "/api/grupos/orden",
        json={"grupo_ids": [homeland["id"], buildeado["id"], proceso["id"]]},
    )
    assert respuesta.status_code == 200
    assert [(g["nombre"], g["orden"]) for g in respuesta.json()["grupos"]] == [
        ("Homeland", 1),
        ("Buildeado", 2),
        ("En proceso", 3),
    ]
    assert _ordenes_de_grupos(usuario_a) == [("Homeland", 1), ("Buildeado", 2), ("En proceso", 3)]


def test_reordenar_dos_grupos_conserva_los_huecos(usuario_a: ClienteAutenticado) -> None:
    uno, dos, tres = (_crear_grupo(usuario_a, n) for n in ("Uno", "Dos", "Tres"))
    usuario_a.delete(f"/api/grupos/{dos['id']}")
    respuesta = usuario_a.put("/api/grupos/orden", json={"grupo_ids": [tres["id"], uno["id"]]})
    assert respuesta.status_code == 200
    assert _ordenes_de_grupos(usuario_a) == [("Tres", 1), ("Uno", 3)]


def test_reordenar_con_el_mismo_orden_no_cambia_nada(usuario_a: ClienteAutenticado) -> None:
    uno, dos = _crear_grupo(usuario_a, "Uno"), _crear_grupo(usuario_a, "Dos")
    respuesta = usuario_a.put("/api/grupos/orden", json={"grupo_ids": [uno["id"], dos["id"]]})
    assert respuesta.status_code == 200
    assert _ordenes_de_grupos(usuario_a) == [("Uno", 1), ("Dos", 2)]


def test_reordenar_con_un_solo_grupo(usuario_a: ClienteAutenticado) -> None:
    uno = _crear_grupo(usuario_a, "Uno")
    assert usuario_a.put("/api/grupos/orden", json={"grupo_ids": [uno["id"]]}).status_code == 200


def test_el_reordenamiento_no_toca_los_teams_ni_los_grupos_ajenos(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    uno, dos = _crear_grupo(usuario_a, "Uno"), _crear_grupo(usuario_a, "Dos")
    _crear_grupo(usuario_b, "De B")
    team = _crear_team(usuario_a)
    usuario_a.put("/api/grupos/orden", json={"grupo_ids": [dos["id"], uno["id"]]})
    assert _lista(usuario_a)["teams"][0]["orden"] == team["orden"]
    assert _ordenes_de_grupos(usuario_b) == [("De B", 1)]


def test_reordenar_con_lista_incompleta_o_ajena_responde_409_sin_cambios(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    uno, dos = _crear_grupo(usuario_a, "Uno"), _crear_grupo(usuario_a, "Dos")
    de_b = _crear_grupo(usuario_b, "De B")
    listas = [
        [dos["id"]],
        [dos["id"], uno["id"], de_b["id"]],
        [dos["id"], de_b["id"]],
        [dos["id"], str(uuid4())],
    ]
    for lista in listas:
        respuesta = usuario_a.put("/api/grupos/orden", json={"grupo_ids": lista})
        assert respuesta.status_code == 409
        assert respuesta.json() == DESACTUALIZADO
    assert _ordenes_de_grupos(usuario_a) == [("Uno", 1), ("Dos", 2)]


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"grupo_ids": []},
        {"grupo_ids": None},
        {"grupo_ids": ["no-es-uuid"]},
        {"grupo_ids": [1]},
        {},
        {"grupo_ids": [], "extra": 1},
        {"team_ids": []},
    ],
)
def test_reordenar_grupos_con_cuerpo_invalido_responde_422(
    usuario_a: ClienteAutenticado, cuerpo: dict[str, Any]
) -> None:
    _crear_grupo(usuario_a)
    assert usuario_a.put("/api/grupos/orden", json=cuerpo).status_code == 422


def test_reordenar_grupos_con_un_id_repetido_o_5_ids_responde_422(
    usuario_a: ClienteAutenticado,
) -> None:
    uno = _crear_grupo(usuario_a, "Uno")
    assert (
        usuario_a.put("/api/grupos/orden", json={"grupo_ids": [uno["id"], uno["id"]]}).status_code
        == 422
    )
    cinco = [str(uuid4()) for _ in range(5)]
    assert usuario_a.put("/api/grupos/orden", json={"grupo_ids": cinco}).status_code == 422
    assert _ordenes_de_grupos(usuario_a) == [("Uno", 1)]


def test_reordenar_grupos_sin_token_responde_401(cliente_api: TestClient) -> None:
    assert cliente_api.put("/api/grupos/orden", json={"grupo_ids": []}).status_code == 401


def _orden_de_teams(cliente: ClienteAutenticado) -> dict[str, int]:
    return {t["nombre"]: t["orden"] for t in _lista(cliente)["teams"]}


def _grupo_con_teams(
    cliente: ClienteAutenticado, ordenes_en_grupo: list[int], total: int
) -> tuple[dict[str, Any], dict[int, dict[str, Any]]]:
    teams = {orden: _crear_team(cliente, f"T{orden}") for orden in range(1, total + 1)}
    grupo = _crear_grupo(cliente)
    for orden in ordenes_en_grupo:
        assert _agregar(cliente, grupo, teams[orden]).status_code == 200
    return grupo, teams


def test_reordenar_los_teams_de_un_grupo_conserva_los_valores_de_orden(
    usuario_a: ClienteAutenticado,
) -> None:
    grupo, teams = _grupo_con_teams(usuario_a, [2, 5, 9], total=9)
    respuesta = usuario_a.put(
        f"/api/grupos/{grupo['id']}/orden",
        json={"team_ids": [teams[9]["id"], teams[2]["id"], teams[5]["id"]]},
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["grupos"][0]["team_ids"] == [teams[9]["id"], teams[2]["id"], teams[5]["id"]]
    ordenes = {t["nombre"]: t["orden"] for t in cuerpo["teams"]}
    assert (ordenes["T9"], ordenes["T2"], ordenes["T5"]) == (2, 5, 9)
    assert ordenes["T3"] == 3
    assert ordenes == _orden_de_teams(usuario_a)


def test_intercambiar_dos_teams_contiguos_de_un_grupo(usuario_a: ClienteAutenticado) -> None:
    grupo, teams = _grupo_con_teams(usuario_a, [1, 2], total=2)
    respuesta = usuario_a.put(
        f"/api/grupos/{grupo['id']}/orden", json={"team_ids": [teams[2]["id"], teams[1]["id"]]}
    )
    assert respuesta.status_code == 200
    assert _orden_de_teams(usuario_a) == {"T2": 1, "T1": 2}


def test_la_portada_automatica_pasa_al_primero_tras_reordenar(
    usuario_a: ClienteAutenticado,
) -> None:
    grupo, teams = _grupo_con_teams(usuario_a, [1, 2, 3], total=3)
    respuesta = usuario_a.put(
        f"/api/grupos/{grupo['id']}/orden",
        json={"team_ids": [teams[3]["id"], teams[1]["id"], teams[2]["id"]]},
    )
    assert respuesta.json()["grupos"][0]["portada_efectiva_team_id"] == teams[3]["id"]


def test_reordenar_un_grupo_con_un_solo_team(usuario_a: ClienteAutenticado) -> None:
    grupo, teams = _grupo_con_teams(usuario_a, [1], total=1)
    respuesta = usuario_a.put(
        f"/api/grupos/{grupo['id']}/orden", json={"team_ids": [teams[1]["id"]]}
    )
    assert respuesta.status_code == 200


def test_reordenar_los_teams_de_un_grupo_con_lista_desactualizada_responde_409(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    grupo, teams = _grupo_con_teams(usuario_a, [1, 2], total=4)
    de_b = _crear_team(usuario_b, "De B")
    usuario_a.delete(f"/api/grupos/{grupo['id']}/teams/{teams[2]['id']}")
    _agregar(usuario_a, grupo, teams[2])
    listas = [
        [teams[1]["id"]],
        [teams[1]["id"], teams[2]["id"], teams[3]["id"]],
        [teams[1]["id"], de_b["id"]],
        [teams[1]["id"], str(uuid4())],
    ]
    for lista in listas:
        respuesta = usuario_a.put(f"/api/grupos/{grupo['id']}/orden", json={"team_ids": lista})
        assert respuesta.status_code == 409
        assert respuesta.json() == DESACTUALIZADO
    assert _orden_de_teams(usuario_a)["T1"] == 1
    assert _grupo_en(usuario_a, grupo["id"])["team_ids"] == [teams[1]["id"], teams[2]["id"]]


@pytest.mark.parametrize(
    "cuerpo",
    [{"team_ids": []}, {"team_ids": None}, {"team_ids": ["x"]}, {}, {"team_ids": [], "extra": 1}],
)
def test_reordenar_los_teams_de_un_grupo_con_cuerpo_invalido_responde_422(
    usuario_a: ClienteAutenticado, cuerpo: dict[str, Any]
) -> None:
    grupo = _crear_grupo(usuario_a)
    assert usuario_a.put(f"/api/grupos/{grupo['id']}/orden", json=cuerpo).status_code == 422


def test_reordenar_un_grupo_con_ids_repetidos_o_6_ids_responde_422(
    usuario_a: ClienteAutenticado,
) -> None:
    grupo, teams = _grupo_con_teams(usuario_a, [1, 2], total=2)
    repetido = {"team_ids": [teams[1]["id"], teams[1]["id"]]}
    seis = {"team_ids": [str(uuid4()) for _ in range(6)]}
    assert usuario_a.put(f"/api/grupos/{grupo['id']}/orden", json=repetido).status_code == 422
    assert usuario_a.put(f"/api/grupos/{grupo['id']}/orden", json=seis).status_code == 422
    assert _orden_de_teams(usuario_a) == {"T1": 1, "T2": 2}


def test_reordenar_un_grupo_ajeno_responde_el_mismo_404_que_uno_inexistente(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    grupo, teams = _grupo_con_teams(usuario_a, [1, 2], total=2)
    cuerpo = {"team_ids": [teams[2]["id"], teams[1]["id"]]}
    ajeno = usuario_b.put(f"/api/grupos/{grupo['id']}/orden", json=cuerpo)
    inexistente = usuario_b.put(f"/api/grupos/{uuid4()}/orden", json=cuerpo)
    assert ajeno.status_code == inexistente.status_code == 404
    assert ajeno.json() == inexistente.json() == {"detail": "No encontrado"}
    assert _orden_de_teams(usuario_a) == {"T1": 1, "T2": 2}


def test_reordenar_un_grupo_con_id_que_no_es_uuid_responde_422(
    usuario_a: ClienteAutenticado,
) -> None:
    assert (
        usuario_a.put("/api/grupos/x/orden", json={"team_ids": [str(uuid4())]}).status_code == 422
    )


def _ordenar_sueltos(cliente: ClienteAutenticado, ids: list[str]) -> Response:
    return cliente.put("/api/teams/sueltos/orden", json={"team_ids": ids})


def test_reordenar_los_sueltos_no_toca_a_los_teams_de_un_grupo(
    usuario_a: ClienteAutenticado,
) -> None:
    teams = {n: _crear_team(usuario_a, f"T{n}") for n in range(1, 5)}
    grupo = _crear_grupo(usuario_a)
    _agregar(usuario_a, grupo, teams[2])
    respuesta = _ordenar_sueltos(usuario_a, [teams[4]["id"], teams[3]["id"], teams[1]["id"]])
    assert respuesta.status_code == 200
    ordenes = {t["nombre"]: t["orden"] for t in respuesta.json()["teams"]}
    assert ordenes == {"T4": 1, "T3": 3, "T1": 4, "T2": 2}
    assert ordenes == _orden_de_teams(usuario_a)


def test_intercambiar_dos_sueltos_contiguos(usuario_a: ClienteAutenticado) -> None:
    uno, dos = _crear_team(usuario_a, "Uno"), _crear_team(usuario_a, "Dos")
    assert _ordenar_sueltos(usuario_a, [dos["id"], uno["id"]]).status_code == 200
    assert _orden_de_teams(usuario_a) == {"Dos": 1, "Uno": 2}


def test_un_team_de_un_grupo_en_la_lista_de_sueltos_responde_409(
    usuario_a: ClienteAutenticado,
) -> None:
    suelto, en_grupo = _crear_team(usuario_a, "Suelto"), _crear_team(usuario_a, "EnGrupo")
    _agregar(usuario_a, _crear_grupo(usuario_a), en_grupo)
    for lista in ([suelto["id"], en_grupo["id"]], [en_grupo["id"]]):
        respuesta = _ordenar_sueltos(usuario_a, lista)
        assert respuesta.status_code == 409
        assert respuesta.json() == DESACTUALIZADO
    assert _orden_de_teams(usuario_a) == {"Suelto": 1, "EnGrupo": 2}


def test_reordenar_sueltos_con_un_team_ajeno_o_faltante_responde_409(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado
) -> None:
    uno, dos = _crear_team(usuario_a, "Uno"), _crear_team(usuario_a, "Dos")
    de_b = _crear_team(usuario_b, "De B")
    for lista in ([uno["id"]], [uno["id"], de_b["id"]], [uno["id"], dos["id"], str(uuid4())]):
        assert _ordenar_sueltos(usuario_a, lista).status_code == 409
    assert _orden_de_teams(usuario_b) == {"De B": 1}


def test_reordenar_sueltos_con_cuerpo_invalido_responde_422(usuario_a: ClienteAutenticado) -> None:
    uno = _crear_team(usuario_a, "Uno")
    cuerpos: list[dict[str, Any]] = [
        {"team_ids": []},
        {"team_ids": [uno["id"], uno["id"]]},
        {"team_ids": ["x"]},
        {"team_ids": [str(uuid4()) for _ in range(21)]},
        {"team_ids": [uno["id"]], "extra": 1},
        {},
    ]
    for cuerpo in cuerpos:
        assert usuario_a.put("/api/teams/sueltos/orden", json=cuerpo).status_code == 422
    assert _orden_de_teams(usuario_a) == {"Uno": 1}


def test_veinte_sueltos_se_pueden_reordenar(usuario_a: ClienteAutenticado) -> None:
    teams = [_crear_team(usuario_a, f"T{n}") for n in range(1, 21)]
    ids = [t["id"] for t in reversed(teams)]
    assert _ordenar_sueltos(usuario_a, ids).status_code == 200
    assert _orden_de_teams(usuario_a)["T20"] == 1


def test_crear_despues_de_reordenar_usa_la_menor_posicion_libre(
    usuario_a: ClienteAutenticado,
) -> None:
    teams = [_crear_team(usuario_a, f"T{n}") for n in (1, 2, 3, 4)]
    usuario_a.delete(f"/api/teams/{teams[2]['id']}")
    _ordenar_sueltos(usuario_a, [teams[3]["id"], teams[0]["id"], teams[1]["id"]])
    assert _crear_team(usuario_a, "Nuevo")["orden"] == 3
