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
SUBRUTAS = ("/api/calculo/catalogo", "/api/calculo/stats", "/api/calculo/potencial")


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
        "etapa_estrella": 1,
        "personalidad": "ENFJ",
        "objetos": [{"posicion": "equipado", "objeto_id": "ejemplo-objeto-x", "nivel": 1}],
    }
    return {**base, **cambios}


def pedido_de_potencial(**cambios: object) -> dict[str, Any]:
    base: dict[str, Any] = {
        "nivel": 60,
        "etapa_estrella": 6,
        "potenciales": {
            "ps": 11,
            "atq": 20,
            "def_fisica": 5,
            "def_magica": 4,
            "regen": 20,
            "quiebre": 6,
        },
        "personalidad": "ENFJ",
        "objeto_equipado": None,
        "despertares_usados": 28,
        "despertares_total": 43,
        "fecha_parche": None,
    }
    return {**base, **cambios}


def _pedir(cliente: TestClient, ruta: str) -> Response:
    if ruta.endswith("catalogo"):
        return cliente.get(ruta)
    cuerpo = pedido_de_potencial() if ruta.endswith("potencial") else pedido()
    return cliente.post(ruta, json=cuerpo)


def _sin_token(cliente: TestClient, ruta: str) -> Response:
    return _pedir(cliente, ruta)


@pytest.mark.parametrize("ruta", SUBRUTAS)
def test_sin_token_responde_401(cliente_api: TestClient, ruta: str) -> None:
    assert _sin_token(cliente_api, ruta).status_code == 401


@pytest.mark.parametrize("ruta", SUBRUTAS)
def test_con_token_vencido_responde_401(
    cliente_api: TestClient, usuario_a: ClienteAutenticado, reloj: RelojFalso, ruta: str
) -> None:
    reloj.avanzar(days=2)

    respuesta = _pedir(usuario_a, ruta)

    assert respuesta.status_code == 401


def test_catalogo_resumido(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.get("/api/calculo/catalogo")

    assert respuesta.status_code == 200
    assert respuesta.headers["Cache-Control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["es_ejemplo"] is True
    assert cuerpo["formato"] == 2
    assert cuerpo["version"] == "ejemplo-2"
    assert cuerpo["estimacion_verificada"] is False
    assert cuerpo["fecha_parche"] == "2026-09-23"
    assert cuerpo["cambios_conocidos"] == [
        {"fecha": "2026-09-23", "descripcion": "Actualización del 23/09", "confianza": "fan"}
    ]
    assert cuerpo["especies"] == [
        {"id": "ejemplo-a", "nombre": "EJEMPLO Aniimo A"},
        {"id": "ejemplo-b", "nombre": "EJEMPLO Aniimo B"},
    ]
    assert [o["id"] for o in cuerpo["objetos"]] == ["ejemplo-objeto-x", "ejemplo-objeto-y"]
    assert cuerpo["sin_datos"] == []
    assert set(cuerpo) == {
        "formato",
        "version",
        "es_ejemplo",
        "estimacion_verificada",
        "fecha_parche",
        "cambios_conocidos",
        "especies",
        "objetos",
        "sin_datos",
    }


def test_calculo_con_objeto_equipado(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.post("/api/calculo/stats", json=pedido())

    assert respuesta.status_code == 200
    assert respuesta.headers["Cache-Control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["es_ejemplo"] is True
    assert cuerpo["version"] == "ejemplo-2"
    assert cuerpo["estimacion_verificada"] is False
    assert cuerpo["fecha_parche"] == "2026-09-23"
    atq = cuerpo["stats"]["atq"]
    assert atq["valor"] == 474
    assert atq["valor_con_objetos"] == 522
    assert atq["aproximado"] is True
    assert atq["motivo"] is None
    assert atq["desglose"][0] == {
        "origen": "base",
        "detalle": "nivel 30",
        "tipo": "base",
        "valor": 390.0,
    }
    assert set(cuerpo["stats"]) == {"ps", "atq", "def_fisica", "def_magica", "regen", "quiebre"}
    assert cuerpo["cp"]["valor"] == 594
    assert cuerpo["cp"]["valor_con_objetos"] == 642
    assert cuerpo["objetos"] == [{"posicion": "equipado", "aplicado": True, "nota": None}]
    assert cuerpo["sin_datos"] == []


def test_calculo_sin_objetos_ni_personalidad(usuario_a: ClienteAutenticado) -> None:
    cuerpo = usuario_a.post(
        "/api/calculo/stats", json=pedido(objetos=[], personalidad=None, nivel=60)
    ).json()

    assert cuerpo["stats"]["atq"]["valor"] == 815
    assert cuerpo["objetos"] == []


def test_objeto_desconocido_responde_200_con_nota(usuario_a: ClienteAutenticado) -> None:
    objetos = [{"posicion": "equipado", "objeto_id": "no-existe", "nivel": 1}]

    respuesta = usuario_a.post("/api/calculo/stats", json=pedido(objetos=objetos))

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["objetos"] == [
        {"posicion": "equipado", "aplicado": False, "nota": "objeto-desconocido"}
    ]
    assert cuerpo["stats"]["atq"]["valor_con_objetos"] == 474


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
    "etapa_8": lambda p: p.update(etapa_estrella=8),
    "etapa_nula": lambda p: p.update(etapa_estrella=None),
    "etapa_negativa": lambda p: p.update(etapa_estrella=-1),
    "etapa_string": lambda p: p.update(etapa_estrella="1"),
    "con_estrella_actual": lambda p: p.update(estrella_actual=1),
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
        assert (
            usuario_a.post("/api/calculo/potencial", json=pedido_de_potencial()).status_code == 200
        )
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
    respuesta = _pedir(cliente, ruta)

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
    assert cliente.post("/api/calculo/potencial", json=pedido_de_potencial()).status_code == 401


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


def test_catalogo_con_el_formato_anterior_responde_503_en_las_tres_rutas(
    test_settings: Settings,
    session_factory: sessionmaker[Session],
    hasher_espia: HasherEspia,
    reloj: RelojFalso,
    tmp_path: Path,
) -> None:
    datos = json.loads(RUTA_POR_DEFECTO.read_text(encoding="utf-8"))
    del datos["formato"]
    ruta = tmp_path / "viejo.json"
    ruta.write_text(json.dumps(datos), encoding="utf-8")
    app = create_app(
        test_settings,
        session_factory=session_factory,
        hasher=hasher_espia,
        reloj=reloj,
        ruta_catalogo=ruta,
    )
    cliente = autenticar(TestClient(app), "usuario_viejo")

    for ruta_de_calculo in SUBRUTAS:
        respuesta = _pedir(cliente, ruta_de_calculo)
        assert respuesta.status_code == 503
        assert respuesta.json() == {"detail": MENSAJE_503}
    assert cliente.get("/api/health").status_code == 200


def test_potencial_de_irisalis(usuario_a: ClienteAutenticado) -> None:
    respuesta = usuario_a.post("/api/calculo/potencial", json=pedido_de_potencial())

    assert respuesta.status_code == 200
    assert respuesta.headers["Cache-Control"] == "no-store"
    cuerpo = respuesta.json()
    assert cuerpo["version"] == "ejemplo-2"
    assert cuerpo["es_ejemplo"] is True
    assert cuerpo["fecha_parche"] == "2026-09-23"
    potencial = cuerpo["potencial"]
    assert potencial["confianza"] == "medido"
    assert (potencial["por_punto"], potencial["salto_cada"], potencial["salto_porcentaje"]) == (
        0.8,
        4,
        4,
    )
    assert potencial["cuenta_estrella"] is True
    ps = potencial["stats"]["ps"]
    assert (ps["n"], ps["saltos"], ps["puntos_al_proximo"]) == (13, 3, 3)
    assert ps["bono_estrella"] == 2
    assert ps["via_despertar"] == "si"
    assert potencial["stats"]["atq"]["via_despertar"] == "tope"
    assert set(ps) == {
        "potencial",
        "bono_estrella",
        "bono_objeto",
        "n",
        "saltos",
        "proximo_salto",
        "puntos_al_proximo",
        "porcentaje_por_puntos",
        "porcentaje_por_saltos",
        "via_despertar",
    }
    despertar = cuerpo["despertar"]
    assert (despertar["cupo_sugerido"], despertar["diferencia"], despertar["restantes"]) == (
        43,
        0,
        15,
    )
    assert despertar["confianza"] == "medido"
    assert despertar["desglose"][-1] == {"origen": "etapa", "detalle": "etapa 6", "suma": 8}
    assert [s["letra"] for s in cuerpo["personalidad"]] == ["E", "N", "F", "J"]
    assert cuerpo["personalidad"][2]["letra_confirmada"] is False
    assert cuerpo["objeto"] is None
    assert cuerpo["version_desconocida"] is True
    assert [a["fecha"] for a in cuerpo["avisos"]] == ["2026-09-23"]
    assert cuerpo["sin_datos"] == []


def test_potencial_con_fecha_al_dia_no_tiene_avisos(usuario_a: ClienteAutenticado) -> None:
    cuerpo = usuario_a.post(
        "/api/calculo/potencial", json=pedido_de_potencial(fecha_parche="2026-09-23")
    ).json()

    assert cuerpo["version_desconocida"] is False
    assert cuerpo["avisos"] == []


def test_potencial_con_objeto_que_da_bono(usuario_a: ClienteAutenticado) -> None:
    objeto = {"objeto_id": "ejemplo-objeto-x", "nivel": 2}

    cuerpo = usuario_a.post(
        "/api/calculo/potencial", json=pedido_de_potencial(objeto_equipado=objeto)
    ).json()

    assert cuerpo["objeto"] == {"aplicado": True, "nota": None}
    assert cuerpo["potencial"]["stats"]["atq"]["bono_objeto"] == 2


def test_potencial_con_objeto_desconocido_responde_200(usuario_a: ClienteAutenticado) -> None:
    objeto = {"objeto_id": "no-existe", "nivel": 1}

    respuesta = usuario_a.post(
        "/api/calculo/potencial", json=pedido_de_potencial(objeto_equipado=objeto)
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["objeto"] == {"aplicado": False, "nota": "objeto-desconocido"}
    assert all(s["bono_objeto"] == 0 for s in cuerpo["potencial"]["stats"].values())


def test_potencial_sin_personalidad_ni_objeto_sin_elegir(usuario_a: ClienteAutenticado) -> None:
    objeto = {"objeto_id": None, "nivel": 1}

    cuerpo = usuario_a.post(
        "/api/calculo/potencial",
        json=pedido_de_potencial(personalidad=None, objeto_equipado=objeto),
    ).json()

    assert cuerpo["personalidad"] is None
    assert cuerpo["objeto"] == {"aplicado": False, "nota": "sin-elegir"}


CASOS_422_POTENCIAL = {
    "potencial_21": lambda p: p["potenciales"].update(atq=21),
    "nivel_string": lambda p: p.update(nivel="30"),
    "nivel_cero": lambda p: p.update(nivel=0),
    "etapa_8": lambda p: p.update(etapa_estrella=8),
    "etapa_nula": lambda p: p.update(etapa_estrella=None),
    "sin_etapa": lambda p: p.pop("etapa_estrella"),
    "personalidad_xxxx": lambda p: p.update(personalidad="XXXX"),
    "fecha_con_otro_formato": lambda p: p.update(fecha_parche="29/10/2026"),
    "fecha_inexistente": lambda p: p.update(fecha_parche="2026-02-30"),
    "fecha_fuera_de_rango": lambda p: p.update(fecha_parche="2100-01-01"),
    "despertares_44_de_43": lambda p: p.update(despertares_usados=44, despertares_total=43),
    "despertares_negativos": lambda p: p.update(despertares_usados=-1),
    "despertares_10000": lambda p: p.update(despertares_total=10000),
    "stat_de_menos": lambda p: p["potenciales"].pop("quiebre"),
    "objeto_nivel_0": lambda p: p.update(objeto_equipado={"objeto_id": None, "nivel": 0}),
    "objeto_id_con_ruta": lambda p: p.update(objeto_equipado={"objeto_id": "../y", "nivel": 1}),
    "campo_extra": lambda p: p.update({"marcador-xyz": 1}),
    "campo_extra_en_objeto": lambda p: p.update(
        objeto_equipado={"objeto_id": None, "nivel": 1, "marcador-xyz": 1}
    ),
    "con_estrella_actual": lambda p: p.update(estrella_actual=2),
}


@pytest.mark.parametrize("caso", sorted(CASOS_422_POTENCIAL))
def test_potencial_con_entrada_invalida_responde_422_sin_eco(
    usuario_a: ClienteAutenticado, caso: str
) -> None:
    cuerpo = copy.deepcopy(pedido_de_potencial())
    CASOS_422_POTENCIAL[caso](cuerpo)

    respuesta = usuario_a.post("/api/calculo/potencial", json=cuerpo)

    assert respuesta.status_code == 422
    assert "marcador-xyz" not in respuesta.text
    assert "XXXX" not in respuesta.text
    assert "29/10/2026" not in respuesta.text
    assert "2026-02-30" not in respuesta.text
