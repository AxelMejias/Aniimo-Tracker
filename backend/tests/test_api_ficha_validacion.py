from copy import deepcopy
from typing import Any

import pytest
from httpx import Response

from tests.fabricas import ClienteAutenticado, ficha_de_referencia

CENTINELA = "texto-marcador-xyz"


@pytest.fixture
def team_id(usuario_a: ClienteAutenticado) -> str:
    return str(usuario_a.post("/api/teams", json={"nombre": "Principal"}).json()["id"])


def _ruta(team_id: str, slot: int = 1) -> str:
    return f"/api/teams/{team_id}/aniimo/{slot}"


def _con(cambios: dict[str, Any]) -> dict[str, Any]:
    """Ficha de referencia con `cambios` aplicados por ruta ("stats.atq.potencial")."""
    ficha = deepcopy(ficha_de_referencia())
    for ruta, valor in cambios.items():
        *padres, hoja = ruta.split(".")
        destino: Any = ficha
        for clave in padres:
            destino = destino[int(clave)] if clave.isdigit() else destino[clave]
        destino[hoja] = valor
    return ficha


def _sin(ficha: dict[str, Any], *claves: str) -> dict[str, Any]:
    destino = ficha
    for clave in claves[:-1]:
        destino = destino[clave]
    del destino[claves[-1]]
    return ficha


def _locs(respuesta: Response) -> list[list[str | int]]:
    return [error["loc"] for error in respuesta.json()["detail"]]


INVALIDAS: list[tuple[str, dict[str, Any], list[str | int]]] = [
    ("potencial_21", _con({"stats.atq.potencial": 21}), ["body", "stats", "atq", "potencial"]),
    ("potencial_negativo", _con({"stats.ps.potencial": -1}), ["body", "stats", "ps", "potencial"]),
    ("elemento_metal", _con({"elemento": "metal"}), ["body", "elemento"]),
    ("elemento_etiqueta", _con({"elemento": "Eléctrico"}), ["body", "elemento"]),
    ("rol_etiqueta_dps", _con({"rol": "DPS"}), ["body", "rol"]),
    ("potencial_innato", _con({"potencial_innato": "divino"}), ["body", "potencial_innato"]),
    ("rareza_mitica", _con({"objetos.0.rareza": "mitica"}), ["body", "objetos", 0, "rareza"]),
    (
        "posicion_objeto",
        _con({"objetos.0.posicion": "reserva"}),
        ["body", "objetos", 0, "posicion"],
    ),
    ("personalidad_EEFJ", _con({"personalidad": "EEFJ"}), ["body", "personalidad"]),
    ("personalidad_minuscula", _con({"personalidad": "enfj"}), ["body", "personalidad"]),
    ("personalidad_corta", _con({"personalidad": "ENF"}), ["body", "personalidad"]),
    (
        "despertares_44_de_43",
        _con({"entrenamiento.despertares_usados": 44}),
        ["body", "entrenamiento", "despertares_usados"],
    ),
    ("cp_10_millones", _con({"cp": 10_000_000}), ["body", "cp"]),
    ("cp_negativo", _con({"cp": -1}), ["body", "cp"]),
    ("nivel_1000", _con({"nivel": 1000}), ["body", "nivel"]),
    ("nivel_0", _con({"nivel": 0}), ["body", "nivel"]),
    (
        "valor_actual_enorme",
        _con({"stats.regen.valor_actual": 10_000_000}),
        ["body", "stats", "regen", "valor_actual"],
    ),
    (
        "bono_negativo",
        _con({"stats.regen.bono_estrellas_incluido": -1}),
        ["body", "stats", "regen", "bono_estrellas_incluido"],
    ),
    (
        "estrella_100",
        _con({"entrenamiento.estrella_actual": 100}),
        ["body", "entrenamiento", "estrella_actual"],
    ),
    (
        "nivel_requerido_0",
        _con({"entrenamiento.nivel_requerido_siguiente_etapa": 0}),
        ["body", "entrenamiento", "nivel_requerido_siguiente_etapa"],
    ),
    (
        "ganancia_enorme",
        _con({"entrenamiento.ganancia_despertar": 10_000}),
        ["body", "entrenamiento", "ganancia_despertar"],
    ),
    (
        "despertares_total_enorme",
        _con({"entrenamiento.despertares_total": 10_000}),
        ["body", "entrenamiento", "despertares_total"],
    ),
    (
        "tengo_enorme",
        _con({"entrenamiento.materiales.0.tengo": 10_000_000}),
        ["body", "entrenamiento", "materiales", 0, "tengo"],
    ),
    (
        "necesito_negativo",
        _con({"entrenamiento.materiales.0.necesito": -1}),
        ["body", "entrenamiento", "materiales", 0, "necesito"],
    ),
    (
        "posicion_material_4",
        _con({"entrenamiento.materiales.0.posicion": 4}),
        ["body", "entrenamiento", "materiales", 0, "posicion"],
    ),
    ("nivel_de_objeto_100", _con({"objetos.0.nivel": 100}), ["body", "objetos", 0, "nivel"]),
    ("nivel_de_objeto_0", _con({"objetos.0.nivel": 0}), ["body", "objetos", 0, "nivel"]),
    ("nombre_vacio", _con({"nombre": "   "}), ["body", "nombre"]),
    ("nombre_51", _con({"nombre": "x" * 51}), ["body", "nombre"]),
    (
        "nombre_de_material_vacio",
        _con({"entrenamiento.materiales.1.nombre": ""}),
        ["body", "entrenamiento", "materiales", 1, "nombre"],
    ),
    ("nombre_de_objeto_51", _con({"objetos.1.nombre": "x" * 51}), ["body", "objetos", 1, "nombre"]),
    (
        "notas_de_stat_501",
        _con({"stats.ps.notas": "x" * 501}),
        ["body", "stats", "ps", "notas"],
    ),
    (
        "efecto_nucleo_1001",
        _con({"objetos.0.efecto_nucleo_notas": "x" * 1001}),
        ["body", "objetos", 0, "efecto_nucleo_notas"],
    ),
    ("notas_4001", _con({"notas": "x" * 4001}), ["body", "notas"]),
    (
        "notas_habilidades_4001",
        _con({"notas_habilidades": "x" * 4001}),
        ["body", "notas_habilidades"],
    ),
    ("nivel_string", _con({"nivel": "60"}), ["body", "nivel"]),
    ("nivel_flotante", _con({"nivel": 60.5}), ["body", "nivel"]),
    ("nivel_booleano", _con({"nivel": True}), ["body", "nivel"]),
    (
        "contrato_string",
        _con({"objetos.0.contrato": "true"}),
        ["body", "objetos", 0, "contrato"],
    ),
    ("campo_extra", {**ficha_de_referencia(), "descuento": 1}, ["body", "descuento"]),
    (
        "campo_extra_anidado_en_stat",
        _con({"stats.atq.descuento": 1}),
        ["body", "stats", "atq", "descuento"],
    ),
    (
        "campo_extra_en_material",
        _con({"entrenamiento.materiales.0.descuento": 1}),
        ["body", "entrenamiento", "materiales", 0, "descuento"],
    ),
    (
        "campo_extra_en_objeto",
        _con({"objetos.0.descuento": 1}),
        ["body", "objetos", 0, "descuento"],
    ),
    (
        "cinco_stats",
        _sin(_con({}), "stats", "quiebre"),
        ["body", "stats", "quiebre"],
    ),
    (
        "stat_extra",
        _con(
            {
                "stats.velocidad": {
                    "valor_actual": 1,
                    "potencial": 1,
                    "bono_estrellas_incluido": 0,
                    "notas": None,
                }
            }
        ),
        ["body", "stats", "velocidad"],
    ),
]


@pytest.mark.parametrize(
    ("ficha", "loc"),
    [pytest.param(f, loc, id=i) for i, f, loc in INVALIDAS],
)
def test_ficha_invalida_responde_422_con_loc_y_no_guarda(
    usuario_a: ClienteAutenticado,
    team_id: str,
    ficha: dict[str, Any],
    loc: list[str | int],
) -> None:
    respuesta = usuario_a.put(_ruta(team_id), json=ficha)
    assert respuesta.status_code == 422
    assert loc in _locs(respuesta)
    assert usuario_a.get(_ruta(team_id)).json() == {"aniimo": None}


def test_una_ficha_invalida_no_pisa_la_guardada(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    usuario_a.put(_ruta(team_id), json=ficha_de_referencia())
    respuesta = usuario_a.put(_ruta(team_id), json=_con({"nombre": "Otra", "nivel": 1000}))
    assert respuesta.status_code == 422
    assert usuario_a.get(_ruta(team_id)).json()["aniimo"]["nombre"] == "Irisalis"


@pytest.mark.parametrize(
    "cambios",
    [
        {
            "entrenamiento.materiales": [
                {"posicion": 1, "nombre": "a", "tengo": 0, "necesito": 0},
                {"posicion": 2, "nombre": "b", "tengo": 0, "necesito": 0},
                {"posicion": 3, "nombre": "c", "tengo": 0, "necesito": 0},
                {"posicion": 1, "nombre": "d", "tengo": 0, "necesito": 0},
            ]
        },
        {
            "entrenamiento.materiales": [
                {"posicion": 1, "nombre": "a", "tengo": 0, "necesito": 0},
                {"posicion": 1, "nombre": "b", "tengo": 0, "necesito": 0},
            ]
        },
    ],
    ids=["cuatro_materiales", "posiciones_de_material_repetidas"],
)
def test_materiales_de_mas_o_repetidos_responden_422(
    usuario_a: ClienteAutenticado, team_id: str, cambios: dict[str, Any]
) -> None:
    respuesta = usuario_a.put(_ruta(team_id), json=_con(cambios))
    assert respuesta.status_code == 422
    assert ["body", "entrenamiento", "materiales"] in [loc[:3] for loc in _locs(respuesta)]


def test_dos_objetos_equipados_responden_422(usuario_a: ClienteAutenticado, team_id: str) -> None:
    ficha = _con({"objetos.1.posicion": "equipado"})
    respuesta = usuario_a.put(_ruta(team_id), json=ficha)
    assert respuesta.status_code == 422
    assert ["body", "objetos"] in _locs(respuesta)


def test_tres_objetos_responden_422(usuario_a: ClienteAutenticado, team_id: str) -> None:
    ficha = ficha_de_referencia()
    ficha["objetos"].append(dict(ficha["objetos"][1]))
    assert usuario_a.put(_ruta(team_id), json=ficha).status_code == 422


@pytest.mark.parametrize(
    "clave",
    ["nombre", "stats", "entrenamiento", "objetos", "nivel", "cp", "notas"],
)
def test_ficha_sin_una_clave_obligatoria_responde_422(
    usuario_a: ClienteAutenticado, team_id: str, clave: str
) -> None:
    ficha = ficha_de_referencia()
    del ficha[clave]
    respuesta = usuario_a.put(_ruta(team_id), json=ficha)
    assert respuesta.status_code == 422
    assert ["body", clave] in _locs(respuesta)


def test_la_respuesta_422_no_contiene_el_texto_enviado(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    ficha = {**_con({"notas": CENTINELA}), "campo_extra": CENTINELA, "nivel": CENTINELA}
    respuesta = usuario_a.put(_ruta(team_id), json=ficha)
    assert respuesta.status_code == 422
    assert CENTINELA not in respuesta.text


def test_cuerpo_que_no_es_json_responde_422(usuario_a: ClienteAutenticado, team_id: str) -> None:
    respuesta = usuario_a.put(
        _ruta(team_id), content=b"no es json", headers={"Content-Type": "application/json"}
    )
    assert respuesta.status_code == 422
