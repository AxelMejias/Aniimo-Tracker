from typing import Any

import pytest

from tests.fabricas import ClienteAutenticado, ficha_de_referencia
from tests.imagenes_de_prueba import WEBP


@pytest.fixture
def team_id(usuario_a: ClienteAutenticado) -> str:
    return str(usuario_a.post("/api/teams", json={"nombre": "Principal"}).json()["id"])


def _ruta(team_id: str, slot: int) -> str:
    return f"/api/teams/{team_id}/aniimo/{slot}"


def _con_slot(ficha: dict[str, Any], slot: int, tiene_imagen: bool = False) -> dict[str, Any]:
    return {**ficha, "slot": slot, "tiene_imagen": tiene_imagen}


def test_crear_en_un_slot_vacio_devuelve_la_ficha_y_get_la_repite(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    ficha = ficha_de_referencia()
    respuesta = usuario_a.put(_ruta(team_id, 1), json=ficha)
    assert respuesta.status_code == 200
    esperado = {"aniimo": _con_slot(ficha, 1)}
    assert respuesta.json() == esperado
    assert usuario_a.get(_ruta(team_id, 1)).json() == esperado


def test_la_ficha_con_los_cinco_bloques_se_lee_igual(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    ficha = ficha_de_referencia()
    usuario_a.put(_ruta(team_id, 2), json=ficha)
    leida = usuario_a.get(_ruta(team_id, 2)).json()["aniimo"]
    assert leida["stats"] == ficha["stats"]
    assert leida["entrenamiento"] == ficha["entrenamiento"]
    assert leida["entrenamiento"]["materiales"][0] == {
        "posicion": 1,
        "nombre": "Polvo estelar",
        "tengo": 413,
        "necesito": 60,
    }
    assert leida["objetos"] == ficha["objetos"]
    assert leida["objetos"][0]["rareza"] == "legendaria"
    assert leida["objetos"][0]["contrato"] is True
    assert leida["notas_habilidades"] == ficha["notas_habilidades"]
    assert leida["notas"] == ficha["notas"]


def test_slot_vacio_devuelve_null(usuario_a: ClienteAutenticado, team_id: str) -> None:
    respuesta = usuario_a.get(_ruta(team_id, 3))
    assert respuesta.status_code == 200
    assert respuesta.json() == {"aniimo": None}


@pytest.mark.parametrize("slot", [0, 5])
def test_slot_fuera_de_rango_al_leer_o_guardar(
    usuario_a: ClienteAutenticado, team_id: str, slot: int
) -> None:
    assert usuario_a.get(_ruta(team_id, slot)).status_code == 422
    assert usuario_a.put(_ruta(team_id, slot), json=ficha_de_referencia()).status_code == 422


def test_reemplazo_completo_descarta_materiales_y_objetos(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    usuario_a.put(_ruta(team_id, 1), json=ficha_de_referencia())
    nueva = ficha_de_referencia()
    nueva["entrenamiento"]["materiales"] = nueva["entrenamiento"]["materiales"][:1]
    nueva["objetos"] = []
    respuesta = usuario_a.put(_ruta(team_id, 1), json=nueva)
    assert respuesta.status_code == 200
    leida = usuario_a.get(_ruta(team_id, 1)).json()["aniimo"]
    assert len(leida["entrenamiento"]["materiales"]) == 1
    assert leida["objetos"] == []


def test_guardar_dos_veces_lo_mismo_es_idempotente(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    ficha = ficha_de_referencia()
    primera = usuario_a.put(_ruta(team_id, 1), json=ficha).json()
    segunda = usuario_a.put(_ruta(team_id, 1), json=ficha).json()
    assert primera == segunda


def test_la_imagen_se_conserva_al_editar_la_ficha(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    usuario_a.put(_ruta(team_id, 1), json=ficha_de_referencia())
    usuario_a.put(
        f"{_ruta(team_id, 1)}/imagen", content=WEBP, headers={"Content-Type": "image/webp"}
    )
    editada = {**ficha_de_referencia(), "nombre": "Editada"}
    respuesta = usuario_a.put(_ruta(team_id, 1), json=editada)
    assert respuesta.json()["aniimo"]["tiene_imagen"] is True
    assert usuario_a.get(f"{_ruta(team_id, 1)}/imagen").content == WEBP


def test_opcionales_en_null_y_notas_en_blanco_se_guardan_como_null(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    ficha = ficha_de_referencia()
    ficha.update(elemento=None, rol=None, potencial_innato=None, personalidad=None, notas="   ")
    ficha["entrenamiento"]["nivel_requerido_siguiente_etapa"] = None
    ficha["notas_habilidades"] = ""
    ficha["stats"]["ps"]["notas"] = " "
    ficha["objetos"][0]["efecto_nucleo_notas"] = "\t"
    leida = usuario_a.put(_ruta(team_id, 1), json=ficha).json()["aniimo"]
    assert leida["elemento"] is None
    assert leida["rol"] is None
    assert leida["potencial_innato"] is None
    assert leida["personalidad"] is None
    assert leida["notas"] is None
    assert leida["notas_habilidades"] is None
    assert leida["entrenamiento"]["nivel_requerido_siguiente_etapa"] is None
    assert leida["stats"]["ps"]["notas"] is None
    assert leida["objetos"][0]["efecto_nucleo_notas"] is None


def test_nombres_se_recortan(usuario_a: ClienteAutenticado, team_id: str) -> None:
    ficha = {**ficha_de_referencia(), "nombre": "  Irisalis  "}
    assert usuario_a.put(_ruta(team_id, 1), json=ficha).json()["aniimo"]["nombre"] == "Irisalis"


def test_nivel_61_se_acepta(usuario_a: ClienteAutenticado, team_id: str) -> None:
    ficha = {**ficha_de_referencia(), "nivel": 61}
    assert usuario_a.put(_ruta(team_id, 1), json=ficha).json()["aniimo"]["nivel"] == 61


def test_los_topes_exactos_se_aceptan(usuario_a: ClienteAutenticado, team_id: str) -> None:
    ficha = ficha_de_referencia()
    ficha.update(nivel=999, cp=9_999_999)
    ficha["stats"]["ps"].update(valor_actual=9_999_999, potencial=20, bono_estrellas_incluido=0)
    ficha["entrenamiento"].update(
        estrella_actual=99, despertares_total=9999, despertares_usados=9999
    )
    assert usuario_a.put(_ruta(team_id, 1), json=ficha).status_code == 200


def test_vaciar_un_slot_ocupado_no_toca_a_los_demas(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    for slot in (1, 2, 3):
        usuario_a.put(_ruta(team_id, slot), json={**ficha_de_referencia(), "nombre": f"A{slot}"})
    respuesta = usuario_a.delete(_ruta(team_id, 2))
    assert respuesta.status_code == 204
    assert respuesta.content == b""
    assert usuario_a.get(_ruta(team_id, 2)).json() == {"aniimo": None}
    assert usuario_a.get(_ruta(team_id, 1)).json()["aniimo"]["nombre"] == "A1"
    assert usuario_a.get(_ruta(team_id, 3)).json()["aniimo"]["nombre"] == "A3"


def test_slot_vaciado_es_reutilizable_sin_rastros_de_la_imagen(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    usuario_a.put(_ruta(team_id, 2), json=ficha_de_referencia())
    usuario_a.put(
        f"{_ruta(team_id, 2)}/imagen", content=WEBP, headers={"Content-Type": "image/webp"}
    )
    usuario_a.delete(_ruta(team_id, 2))
    nueva = usuario_a.put(_ruta(team_id, 2), json={**ficha_de_referencia(), "nombre": "Nueva"})
    assert nueva.status_code == 200
    assert nueva.json()["aniimo"]["tiene_imagen"] is False
    assert usuario_a.get(f"{_ruta(team_id, 2)}/imagen").status_code == 404


def test_vaciar_un_slot_ya_vacio_responde_204(usuario_a: ClienteAutenticado, team_id: str) -> None:
    assert usuario_a.delete(_ruta(team_id, 4)).status_code == 204


def test_las_respuestas_de_ficha_no_se_cachean(usuario_a: ClienteAutenticado, team_id: str) -> None:
    put = usuario_a.put(_ruta(team_id, 1), json=ficha_de_referencia())
    assert put.headers["cache-control"] == "no-store"
    assert usuario_a.get(_ruta(team_id, 1)).headers["cache-control"] == "no-store"
    assert usuario_a.delete(_ruta(team_id, 1)).headers["cache-control"] == "no-store"
