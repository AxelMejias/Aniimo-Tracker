import copy
import json
import logging
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.infrastructure.catalogo_crecimiento import RUTA_POR_DEFECTO
from app.infrastructure.modelos import AniimoDelTeamModelo, TeamModelo, UsuarioModelo
from app.main import create_app
from tests.fabricas import (
    ClienteAutenticado,
    HasherEspia,
    RelojFalso,
    autenticar,
    ficha_de_referencia,
)

MENSAJE_503 = "El cálculo no está disponible: el catálogo de crecimiento es inválido"
SUBRUTAS = ("/api/calculo/catalogo", "/api/calculo/stats")


def pedido(**cambios: object) -> dict[str, Any]:
    base: dict[str, Any] = {
        "especie_id": "ejemplo-a",
        "nivel": 30,
        "potenciales": {
            "ps": 0,
            "atq": 10,
            "def_fisica": 0,
            "def_magica": 0,
            "regen": 0,
            "quiebre": 0,
        },
        "estrella_actual": 1,
        "personalidad": "ENFJ",
        "objetos": [{"posicion": "equipado", "objeto_id": "ejemplo-objeto-x", "nivel": 1}],
    }
    return {**base, **cambios}


def _sin_token(cliente: TestClient, ruta: str) -> Response:
    if ruta.endswith("catalogo"):
        return cliente.get(ruta)
    return cliente.post(ruta, json=pedido())


@pytest.mark.parametrize("ruta", SUBRUTAS)
def test_sin_token_responde_401(cliente_api: TestClient, ruta: str) -> None:
    assert _sin_token(cliente_api, ruta).status_code == 401


@pytest.mark.parametrize("ruta", SUBRUTAS)
def test_con_token_vencido_responde_401(
    cliente_api: TestClient, usuario_a: ClienteAutenticado, reloj: RelojFalso, ruta: str
) -> None:
    reloj.avanzar(days=2)

    respuesta = (
        usuario_a.get(ruta) if ruta.endswith("catalogo") else usuario_a.post(ruta, json=pedido())
    )

    assert respuesta.status_code == 401


def test_catalogo_resumido(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.get("/api/calculo/catalogo")

    assert respuesta.status_code == 200
    assert respuesta.headers["Cache-Control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["es_ejemplo"] is True
    assert cuerpo["version"] == "ejemplo-1"
    assert cuerpo["especies"] == [
        {"id": "ejemplo-a", "nombre": "EJEMPLO Aniimo A"},
        {"id": "ejemplo-b", "nombre": "EJEMPLO Aniimo B"},
    ]
    assert [o["id"] for o in cuerpo["objetos"]] == ["ejemplo-objeto-x", "ejemplo-objeto-y"]
    assert cuerpo["sin_datos"] == []
    assert set(cuerpo) == {"version", "es_ejemplo", "especies", "objetos", "sin_datos"}


def test_calculo_con_objeto_equipado(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.post("/api/calculo/stats", json=pedido())

    assert respuesta.status_code == 200
    assert respuesta.headers["Cache-Control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["es_ejemplo"] is True
    assert cuerpo["version"] == "ejemplo-1"
    atq = cuerpo["stats"]["atq"]
    assert atq["valor"] == 458
    assert atq["valor_con_objetos"] == 509
    assert atq["aproximado"] is True
    assert atq["motivo"] is None
    assert atq["desglose"][0] == {
        "origen": "base",
        "detalle": "nivel 30",
        "tipo": "base",
        "valor": 390.0,
    }
    assert set(cuerpo["stats"]) == {"ps", "atq", "def_fisica", "def_magica", "regen", "quiebre"}
    assert cuerpo["cp"]["valor"] == 578
    assert cuerpo["cp"]["valor_con_objetos"] == 629
    assert cuerpo["objetos"] == [{"posicion": "equipado", "aplicado": True, "nota": None}]
    assert cuerpo["sin_datos"] == []


def test_calculo_sin_objetos_ni_personalidad(usuario_a: ClienteAutenticado) -> None:
    cuerpo = usuario_a.post(
        "/api/calculo/stats", json=pedido(objetos=[], personalidad=None, nivel=60)
    ).json()

    assert cuerpo["stats"]["atq"]["valor"] == 769
    assert cuerpo["objetos"] == []


def test_objeto_desconocido_responde_200_con_nota(usuario_a: ClienteAutenticado) -> None:
    objetos = [{"posicion": "equipado", "objeto_id": "no-existe", "nivel": 1}]

    respuesta = usuario_a.post("/api/calculo/stats", json=pedido(objetos=objetos))

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["objetos"] == [
        {"posicion": "equipado", "aplicado": False, "nota": "objeto-desconocido"}
    ]
    assert cuerpo["stats"]["atq"]["valor_con_objetos"] == 458


def test_objeto_sin_elegir_y_alternativo(usuario_a: ClienteAutenticado) -> None:
    objetos = [
        {"posicion": "equipado", "objeto_id": None, "nivel": 3},
        {"posicion": "alternativo", "objeto_id": "ejemplo-objeto-x", "nivel": 1},
    ]

    cuerpo = usuario_a.post("/api/calculo/stats", json=pedido(objetos=objetos)).json()

    assert [o["nota"] for o in cuerpo["objetos"]] == ["sin-elegir", "alternativo-no-suma"]


def test_fuera_de_rango_devuelve_valores_nulos(usuario_a: ClienteAutenticado) -> None:
    cuerpo = usuario_a.post("/api/calculo/stats", json=pedido(nivel=61)).json()

    assert cuerpo["stats"]["atq"]["valor"] is None
    assert cuerpo["stats"]["atq"]["motivo"] == "fuera-de-rango"
    assert cuerpo["cp"]["valor"] is None
    assert cuerpo["cp"]["motivo"] == "stats-incompletos"


def _sin_un_stat(p: dict[str, Any]) -> None:
    del p["potenciales"]["quiebre"]


def _con_un_stat_de_mas(p: dict[str, Any]) -> None:
    p["potenciales"]["velocidad"] = 1


def _tres_objetos(p: dict[str, Any]) -> None:
    p["objetos"] = [
        {"posicion": "equipado", "objeto_id": None, "nivel": 1},
        {"posicion": "alternativo", "objeto_id": None, "nivel": 1},
        {"posicion": "alternativo", "objeto_id": None, "nivel": 1},
    ]


def _dos_equipados(p: dict[str, Any]) -> None:
    p["objetos"] = [
        {"posicion": "equipado", "objeto_id": None, "nivel": 1},
        {"posicion": "equipado", "objeto_id": None, "nivel": 2},
    ]


CASOS_422 = {
    "potencial_21": lambda p: p["potenciales"].update(atq=21),
    "potencial_negativo": lambda p: p["potenciales"].update(atq=-1),
    "nivel_string": lambda p: p.update(nivel="30"),
    "nivel_cero": lambda p: p.update(nivel=0),
    "nivel_1000": lambda p: p.update(nivel=1000),
    "personalidad_xxxx": lambda p: p.update(personalidad="XXXX"),
    "estrella_100": lambda p: p.update(estrella_actual=100),
    "stat_de_menos": _sin_un_stat,
    "stat_de_mas": _con_un_stat_de_mas,
    "tres_objetos": _tres_objetos,
    "dos_equipados": _dos_equipados,
    "nivel_de_objeto_0": lambda p: p["objetos"][0].update(nivel=0),
    "nivel_de_objeto_100": lambda p: p["objetos"][0].update(nivel=100),
    "objeto_id_con_ruta": lambda p: p["objetos"][0].update(objeto_id="../y"),
    "posicion_desconocida": lambda p: p["objetos"][0].update(posicion="mochila"),
    "campo_extra": lambda p: p.update({"marcador-xyz": 1}),
    "campo_extra_en_objeto": lambda p: p["objetos"][0].update({"marcador-xyz": 1}),
    "especie_id_con_mayusculas": lambda p: p.update(especie_id="Ejemplo-A"),
}


@pytest.mark.parametrize("caso", sorted(CASOS_422))
def test_entrada_invalida_responde_422_sin_eco(usuario_a: ClienteAutenticado, caso: str) -> None:
    cuerpo = copy.deepcopy(pedido())
    CASOS_422[caso](cuerpo)

    respuesta = usuario_a.post("/api/calculo/stats", json=cuerpo)

    assert respuesta.status_code == 422
    assert "marcador-xyz" not in respuesta.text
    assert "mochila" not in respuesta.text
    assert "XXXX" not in respuesta.text


def test_especie_desconocida_responde_422(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.post("/api/calculo/stats", json=pedido(especie_id="no-existe"))

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"][0]["loc"] == ["body", "especie_id"]
    assert "no-existe" not in respuesta.text


def _conteos(session_factory: sessionmaker[Session]) -> tuple[int, int, int]:
    with session_factory() as sesion:
        return tuple(  # type: ignore[return-value]
            sesion.scalar(select(func.count()).select_from(modelo)) or 0
            for modelo in (UsuarioModelo, TeamModelo, AniimoDelTeamModelo)
        )


def test_el_calculo_no_cambia_fichas_teams_ni_usuarios(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session]
) -> None:
    team_id = usuario_a.post("/api/teams", json={"nombre": "Principal"}).json()["id"]
    usuario_a.put(f"/api/teams/{team_id}/aniimo/1", json=ficha_de_referencia())
    antes = (
        usuario_a.get("/api/teams").json(),
        usuario_a.get(f"/api/teams/{team_id}/aniimo/1").json(),
        _conteos(session_factory),
    )

    for _ in range(3):
        assert usuario_a.post("/api/calculo/stats", json=pedido()).status_code == 200
        assert usuario_a.get("/api/calculo/catalogo").status_code == 200

    despues = (
        usuario_a.get("/api/teams").json(),
        usuario_a.get(f"/api/teams/{team_id}/aniimo/1").json(),
        _conteos(session_factory),
    )
    assert despues == antes


@pytest.fixture
def catalogo_roto(tmp_path: Path) -> Path:
    datos = json.loads(RUTA_POR_DEFECTO.read_text(encoding="utf-8"))
    datos["especies"][0]["base"]["atq"][1]["nivel"] = 1
    ruta = tmp_path / "roto.json"
    ruta.write_text(json.dumps(datos), encoding="utf-8")
    return ruta


@pytest.fixture
def usuario_con_catalogo_roto(
    test_settings: Settings,
    session_factory: sessionmaker[Session],
    hasher_espia: HasherEspia,
    reloj: RelojFalso,
    catalogo_roto: Path,
) -> ClienteAutenticado:
    app = create_app(
        test_settings,
        session_factory=session_factory,
        hasher=hasher_espia,
        reloj=reloj,
        ruta_catalogo=catalogo_roto,
    )
    return autenticar(TestClient(app), "usuario_roto")


@pytest.mark.parametrize("ruta", SUBRUTAS)
def test_catalogo_invalido_responde_503_con_mensaje_fijo(
    usuario_con_catalogo_roto: ClienteAutenticado, ruta: str
) -> None:
    cliente = usuario_con_catalogo_roto
    respuesta = (
        cliente.get(ruta) if ruta.endswith("catalogo") else cliente.post(ruta, json=pedido())
    )

    assert respuesta.status_code == 503
    assert respuesta.json() == {"detail": MENSAJE_503}


def test_catalogo_invalido_sigue_pidiendo_autenticacion(
    test_settings: Settings,
    session_factory: sessionmaker[Session],
    hasher_espia: HasherEspia,
    reloj: RelojFalso,
    catalogo_roto: Path,
) -> None:
    app = create_app(
        test_settings,
        session_factory=session_factory,
        hasher=hasher_espia,
        reloj=reloj,
        ruta_catalogo=catalogo_roto,
    )
    cliente = TestClient(app)

    assert cliente.get("/api/calculo/catalogo").status_code == 401
    assert cliente.post("/api/calculo/stats", json=pedido()).status_code == 401


def test_catalogo_invalido_no_rompe_el_resto_de_la_app(
    usuario_con_catalogo_roto: ClienteAutenticado,
) -> None:
    cliente = usuario_con_catalogo_roto
    assert cliente.get("/api/health").status_code == 200
    assert cliente.get("/api/teams").status_code == 200
    team_id = cliente.post("/api/teams", json={"nombre": "Principal"}).json()["id"]
    guardada = cliente.put(f"/api/teams/{team_id}/aniimo/1", json=ficha_de_referencia())
    assert guardada.status_code == 200
    assert cliente.get(f"/api/teams/{team_id}/aniimo/1").status_code == 200


def test_el_error_del_catalogo_queda_en_el_log_con_ruta_y_campo(
    test_settings: Settings,
    session_factory: sessionmaker[Session],
    hasher_espia: HasherEspia,
    reloj: RelojFalso,
    catalogo_roto: Path,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.ERROR, logger="app"):
        create_app(
            test_settings,
            session_factory=session_factory,
            hasher=hasher_espia,
            reloj=reloj,
            ruta_catalogo=catalogo_roto,
        )

    registro = "\n".join(r.getMessage() for r in caplog.records)
    assert str(catalogo_roto) in registro
    assert "especies[0].base.atq[1].nivel" in registro


def test_un_catalogo_valido_no_deja_errores_en_el_log(
    test_settings: Settings,
    session_factory: sessionmaker[Session],
    hasher_espia: HasherEspia,
    reloj: RelojFalso,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.ERROR, logger="app"):
        create_app(test_settings, session_factory=session_factory, hasher=hasher_espia, reloj=reloj)

    assert caplog.records == []
