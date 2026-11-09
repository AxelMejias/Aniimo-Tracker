import json
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from tests.fabricas import Persona, Red, ficha_de_referencia
from tests.imagenes_de_prueba import WEBP

NO_ENCONTRADO = {"detail": "No encontrado"}
CAMPOS_DE_NOTAS = ("notas", "notas_habilidades")


def _crear_team(duenio: Persona, nombre: str = "Principal") -> str:
    return str(duenio.api.post("/api/teams", json={"nombre": nombre}).json()["id"])


def _guardar(duenio: Persona, team_id: str, slot: int = 1, **cambios: object) -> None:
    ficha = {**ficha_de_referencia(), **cambios}
    respuesta = duenio.api.put(f"/api/teams/{team_id}/aniimo/{slot}", json=ficha)
    assert respuesta.status_code == 200, respuesta.text


def _guardar_imagen(duenio: Persona, team_id: str, slot: int = 1) -> None:
    respuesta = duenio.api.put(
        f"/api/teams/{team_id}/aniimo/{slot}/imagen",
        content=WEBP,
        headers={"Content-Type": "image/webp"},
    )
    assert respuesta.status_code == 204


def _teams(lector: Persona, de: Persona) -> Response:
    return lector.api.get(f"/api/amigos/{de.id}/teams")


def _ficha(lector: Persona, de_id: object, team_id: str, slot: int = 1) -> Response:
    return lector.api.get(f"/api/amigos/{de_id}/teams/{team_id}/aniimo/{slot}")


def _imagen(lector: Persona, de_id: object, team_id: str, slot: int = 1) -> Response:
    return lector.api.get(f"/api/amigos/{de_id}/teams/{team_id}/aniimo/{slot}/imagen")


@pytest.fixture
def team_de_b(red: Red) -> str:
    team_id = _crear_team(red.b)
    _guardar(red.b, team_id)
    _guardar_imagen(red.b, team_id)
    return team_id


def test_teams_del_amigo(red: Red, team_de_b: str) -> None:
    respuesta = _teams(red.a, red.b)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["usuario"] == {"id": str(red.b.id), "nombre_usuario": "usuario_b"}
    [team] = cuerpo["teams"]
    assert team["nombre"] == "Principal"
    assert "oculto_para_amigos" not in team
    assert set(team) == {"id", "nombre", "orden", "grupo_id", "portada_slot", "slots"}
    assert team["slots"][0]["aniimo"] == {
        "nombre": "Irisalis",
        "elemento": "hielo",
        "rol": "curacion",
        "nivel": 60,
        "cp": 3475,
        "personalidad": "ENFJ",
        "estrella_actual": 2,
        "despertares_usados": 28,
        "despertares_total": 43,
        "tiene_imagen": True,
    }
    assert [s["aniimo"] for s in team["slots"][1:]] == [None, None, None]
    assert team == {
        k: v
        for k, v in red.b.api.get("/api/teams").json()["teams"][0].items()
        if k in {"id", "nombre", "orden", "grupo_id", "slots"}
    } | {"portada_slot": 1}


def test_el_resumen_del_amigo_trae_elemento_y_rol_de_su_ficha_aun_con_notas_privadas(
    red: Red, team_de_b: str
) -> None:
    _con_notas_en_los_cuatro_campos(red.b, team_de_b, privadas=True)
    resumen = _teams(red.a, red.b).json()["teams"][0]["slots"][0]["aniimo"]
    ficha = _ficha(red.a, red.b.id, team_de_b).json()["aniimo"]
    assert (resumen["elemento"], resumen["rol"]) == ("hielo", "curacion")
    assert (resumen["elemento"], resumen["rol"]) == (ficha["elemento"], ficha["rol"])
    assert all(resumen[c] == ficha[c] for c in ("nombre", "nivel", "personalidad"))
    assert "notas" not in resumen and "notas_privadas" not in resumen


def test_amigo_sin_teams(red: Red) -> None:
    respuesta = _teams(red.a, red.b)
    assert respuesta.status_code == 200
    assert respuesta.json()["teams"] == []
    assert respuesta.json()["grupos"] == []


def test_ficha_completa_igual_a_la_del_duenio_sin_notas_privadas(red: Red, team_de_b: str) -> None:
    del_amigo = _ficha(red.a, red.b.id, team_de_b).json()["aniimo"]
    del_duenio = red.b.api.get(f"/api/teams/{team_de_b}/aniimo/1").json()["aniimo"]
    assert "notas_privadas" not in del_amigo
    assert {k: v for k, v in del_duenio.items() if k != "notas_privadas"} == del_amigo
    assert del_amigo["notas"] == "Aniimo de referencia"
    assert del_amigo["tiene_imagen"] is True


def test_slot_vacio_del_amigo(red: Red, team_de_b: str) -> None:
    respuesta = _ficha(red.a, red.b.id, team_de_b, 3)
    assert respuesta.status_code == 200
    assert respuesta.json() == {"aniimo": None}


def test_imagen_del_amigo(red: Red, team_de_b: str) -> None:
    respuesta = _imagen(red.a, red.b.id, team_de_b)
    assert respuesta.status_code == 200
    assert respuesta.content == WEBP
    assert respuesta.headers["Content-Type"] == "image/webp"
    assert respuesta.headers["X-Content-Type-Options"] == "nosniff"
    assert respuesta.headers["Cache-Control"] == "no-store"


def test_aniimo_del_amigo_sin_imagen_o_slot_vacio_responde_404(red: Red, team_de_b: str) -> None:
    _guardar(red.b, team_de_b, 2, nombre="Sin imagen")
    assert _imagen(red.a, red.b.id, team_de_b, 2).status_code == 404
    assert _imagen(red.a, red.b.id, team_de_b, 4).status_code == 404


def test_todas_las_lecturas_van_sin_cache(red: Red, team_de_b: str) -> None:
    for respuesta in (
        _teams(red.a, red.b),
        _ficha(red.a, red.b.id, team_de_b),
        _imagen(red.a, red.b.id, team_de_b),
    ):
        assert respuesta.headers["Cache-Control"] == "no-store"


# --- matriz de acceso ---


def _tres(lector: Persona, de_id: object, team_id: str) -> list[Response]:
    return [
        lector.api.get(f"/api/amigos/{de_id}/teams"),
        _ficha(lector, de_id, team_id),
        _imagen(lector, de_id, team_id),
    ]


def test_matriz_de_acceso(red: Red, team_de_b: str) -> None:
    team_c = _crear_team(red.c)
    _guardar(red.c, team_c)
    _guardar_imagen(red.c, team_c)
    team_d = _crear_team(red.d)
    _guardar(red.d, team_d)
    _guardar_imagen(red.d, team_d)
    team_e = _crear_team(red.e)
    _guardar(red.e, team_e)
    _guardar_imagen(red.e, team_e)
    team_a = _crear_team(red.a)
    _guardar(red.a, team_a)
    _guardar_imagen(red.a, team_a)
    casos = [
        (red.c.id, team_c),
        (red.d.id, team_d),
        (red.e.id, team_e),
        (uuid4(), str(uuid4())),
        (red.a.id, team_a),
    ]
    for de_id, team_id in casos:
        for respuesta in _tres(red.a, de_id, team_id):
            assert respuesta.status_code == 404, (de_id, respuesta.text)
            assert respuesta.json() == NO_ENCONTRADO
    ok = _tres(red.a, red.b.id, team_de_b)
    assert [r.status_code for r in ok] == [200, 200, 200]
    cuerpos = {
        json.dumps(r.json(), sort_keys=True)
        for de_id, team_id in casos
        for r in _tres(red.a, de_id, team_id)
    }
    assert len(cuerpos) == 1


def test_pendiente_en_ambos_sentidos_tambien_se_niega_a_quien_pidio(
    red: Red, team_de_b: str
) -> None:
    team_a = _crear_team(red.a)
    _guardar(red.a, team_a)
    assert _teams(red.c, red.a).status_code == 404
    assert _ficha(red.c, red.a.id, team_a).status_code == 404
    assert _teams(red.d, red.a).status_code == 404


def test_team_de_un_tercero_por_la_ruta_de_un_amigo(red: Red) -> None:
    team_e = _crear_team(red.e)
    _guardar(red.e, team_e)
    _guardar_imagen(red.e, team_e)
    for respuesta in (_ficha(red.a, red.b.id, team_e), _imagen(red.a, red.b.id, team_e)):
        assert respuesta.status_code == 404
        assert respuesta.json() == NO_ENCONTRADO


def test_ids_mal_formados_responden_422(red: Red, team_de_b: str) -> None:
    assert red.a.api.get("/api/amigos/no-es-uuid/teams").status_code == 422
    assert red.a.api.get(f"/api/amigos/{red.b.id}/teams/no-es-uuid/aniimo/1").status_code == 422


@pytest.mark.parametrize("slot", [0, 5, -1])
def test_slot_fuera_de_rango_responde_422(red: Red, team_de_b: str, slot: int) -> None:
    assert _ficha(red.a, red.b.id, team_de_b, slot).status_code == 422
    assert _imagen(red.a, red.b.id, team_de_b, slot).status_code == 422


def test_acceso_perdido_al_eliminar_la_amistad(red: Red, team_de_b: str) -> None:
    assert _teams(red.a, red.b).status_code == 200
    assert red.b.api.delete(f"/api/amigos/{red.a.id}").status_code == 204
    for respuesta in _tres(red.a, red.b.id, team_de_b):
        assert respuesta.status_code == 404
        assert respuesta.json() == NO_ENCONTRADO


def test_sin_token_responde_401(red: Red, cliente_api: TestClient, team_de_b: str) -> None:
    assert cliente_api.get(f"/api/amigos/{red.b.id}/teams").status_code == 401


# --- team oculto ---


def test_team_oculto_no_se_lista_ni_se_lee_y_volver_a_mostrarlo_lo_restituye(
    red: Red, team_de_b: str
) -> None:
    raid = _crear_team(red.b, "Raid")
    _guardar(red.b, raid)
    _guardar_imagen(red.b, raid)
    assert (
        red.b.api.patch(f"/api/teams/{raid}", json={"oculto_para_amigos": True}).status_code == 200
    )
    nombres = [t["nombre"] for t in _teams(red.a, red.b).json()["teams"]]
    assert nombres == ["Principal"]
    aleatoria = _ficha(red.a, red.b.id, str(uuid4()))
    for respuesta in (_ficha(red.a, red.b.id, raid), _imagen(red.a, red.b.id, raid)):
        assert respuesta.status_code == 404
        assert respuesta.json() == NO_ENCONTRADO
    assert _ficha(red.a, red.b.id, raid).content == aleatoria.content
    assert (
        red.b.api.patch(f"/api/teams/{raid}", json={"oculto_para_amigos": False}).status_code == 200
    )
    assert [t["nombre"] for t in _teams(red.a, red.b).json()["teams"]] == ["Principal", "Raid"]
    assert _ficha(red.a, red.b.id, raid).status_code == 200


def test_el_duenio_sigue_viendo_su_team_oculto(red: Red, team_de_b: str) -> None:
    red.b.api.patch(f"/api/teams/{team_de_b}", json={"oculto_para_amigos": True})
    [team] = red.b.api.get("/api/teams").json()["teams"]
    assert team["oculto_para_amigos"] is True
    assert (
        red.b.api.get(f"/api/teams/{team_de_b}/aniimo/1").json()["aniimo"]["nombre"] == "Irisalis"
    )
    assert red.b.api.get(f"/api/teams/{team_de_b}/aniimo/1/imagen").content == WEBP


# --- notas privadas ---


def _con_notas_en_los_cuatro_campos(duenio: Persona, team_id: str, privadas: bool) -> None:
    ficha = ficha_de_referencia()
    ficha["notas"] = "centinela-notas"
    ficha["notas_habilidades"] = "centinela-habilidades"
    ficha["stats"]["ps"]["notas"] = "centinela-stat"
    ficha["objetos"][0]["efecto_nucleo_notas"] = "centinela-objeto"
    ficha["notas_privadas"] = privadas
    assert duenio.api.put(f"/api/teams/{team_id}/aniimo/1", json=ficha).status_code == 200


def test_notas_privadas_dejan_en_null_los_cuatro_campos_solo_para_el_amigo(
    red: Red, team_de_b: str
) -> None:
    _con_notas_en_los_cuatro_campos(red.b, team_de_b, privadas=True)
    respuesta = _ficha(red.a, red.b.id, team_de_b)
    ficha = respuesta.json()["aniimo"]
    assert ficha["notas"] is None
    assert ficha["notas_habilidades"] is None
    assert ficha["stats"]["ps"]["notas"] is None
    assert ficha["stats"]["atq"]["notas"] is None
    assert all(o["efecto_nucleo_notas"] is None for o in ficha["objetos"])
    assert "centinela" not in respuesta.text
    assert "notas_privadas" not in ficha
    assert ficha["nombre"] == "Irisalis"
    assert ficha["stats"]["ps"]["valor_actual"] == 11321
    assert ficha["objetos"][0]["nombre"] == "Corona antigua"
    propia = red.b.api.get(f"/api/teams/{team_de_b}/aniimo/1").json()["aniimo"]
    assert propia["notas"] == "centinela-notas"
    assert propia["notas_habilidades"] == "centinela-habilidades"
    assert propia["stats"]["ps"]["notas"] == "centinela-stat"
    assert propia["objetos"][0]["efecto_nucleo_notas"] == "centinela-objeto"
    assert propia["notas_privadas"] is True


def test_sin_notas_privadas_el_amigo_lee_las_notas_y_desactivar_las_restituye(
    red: Red, team_de_b: str
) -> None:
    _con_notas_en_los_cuatro_campos(red.b, team_de_b, privadas=False)
    ficha = _ficha(red.a, red.b.id, team_de_b).json()["aniimo"]
    assert ficha["notas"] == "centinela-notas"
    assert ficha["objetos"][0]["efecto_nucleo_notas"] == "centinela-objeto"
    _con_notas_en_los_cuatro_campos(red.b, team_de_b, privadas=True)
    assert _ficha(red.a, red.b.id, team_de_b).json()["aniimo"]["notas"] is None
    _con_notas_en_los_cuatro_campos(red.b, team_de_b, privadas=False)
    assert _ficha(red.a, red.b.id, team_de_b).json()["aniimo"]["notas"] == "centinela-notas"


def test_ficha_privada_es_igual_a_una_ficha_sin_notas(red: Red, team_de_b: str) -> None:
    sin_notas = ficha_de_referencia()
    sin_notas.update(notas=None, notas_habilidades=None)
    for stat in sin_notas["stats"].values():
        stat["notas"] = None
    for objeto in sin_notas["objetos"]:
        objeto["efecto_nucleo_notas"] = None
    red.b.api.put(f"/api/teams/{team_de_b}/aniimo/2", json=sin_notas)
    ficha_privada = ficha_de_referencia()
    ficha_privada["notas_privadas"] = True
    red.b.api.put(f"/api/teams/{team_de_b}/aniimo/3", json=ficha_privada)
    privada = _ficha(red.a, red.b.id, team_de_b, 3).json()["aniimo"]
    vacia = _ficha(red.a, red.b.id, team_de_b, 2).json()["aniimo"]
    assert {k: v for k, v in privada.items() if k != "slot"} == {
        k: v for k, v in vacia.items() if k != "slot"
    }


def test_el_amigo_ve_la_fecha_de_parche_y_la_etapa_de_estrella(red: Red) -> None:
    team_id = _crear_team(red.b)
    _guardar(red.b, team_id, fecha_parche="2026-10-26", etapa_estrella=6)

    ficha = _ficha(red.a, red.b.id, team_id).json()["aniimo"]

    assert ficha["fecha_parche"] == "2026-10-26"
    assert ficha["etapa_estrella"] == 6
    assert ficha["entrenamiento"]["estrella_actual"] == 2


def test_el_amigo_ve_fecha_y_etapa_nulas_cuando_no_estan_cargadas(red: Red) -> None:
    team_id = _crear_team(red.b)
    _guardar(red.b, team_id, fecha_parche=None, etapa_estrella=None)

    ficha = _ficha(red.a, red.b.id, team_id).json()["aniimo"]

    assert (ficha["fecha_parche"], ficha["etapa_estrella"]) == (None, None)


def test_las_notas_privadas_no_ocultan_la_fecha_ni_la_etapa(red: Red) -> None:
    team_id = _crear_team(red.b)
    _guardar(red.b, team_id, notas_privadas=True, fecha_parche="2026-10-26", etapa_estrella=3)

    ficha = _ficha(red.a, red.b.id, team_id).json()["aniimo"]

    assert (ficha["fecha_parche"], ficha["etapa_estrella"]) == ("2026-10-26", 3)


# --- grupos de teams ---


def _crear_grupo(duenio: Persona, nombre: str) -> str:
    cuerpo = duenio.api.post("/api/grupos", json={"nombre": nombre}).json()
    return str(next(g["id"] for g in cuerpo["grupos"] if g["nombre"] == nombre))


def _meter(duenio: Persona, grupo_id: str, team_id: str) -> None:
    assert duenio.api.put(f"/api/grupos/{grupo_id}/teams/{team_id}").status_code == 200


def _ocultar(duenio: Persona, team_id: str) -> None:
    respuesta = duenio.api.patch(f"/api/teams/{team_id}", json={"oculto_para_amigos": True})
    assert respuesta.status_code == 200


def _elegir_portada_de_grupo(duenio: Persona, grupo_id: str, team_id: str) -> None:
    respuesta = duenio.api.patch(f"/api/grupos/{grupo_id}", json={"portada_team_id": team_id})
    assert respuesta.status_code == 200


def _grupos_vistos(lector: Persona, de: Persona) -> list[dict[str, Any]]:
    return _teams(lector, de).json()["grupos"]  # type: ignore[no-any-return]


def test_un_team_suelto_llega_sin_grupo_y_con_la_portada_efectiva(red: Red) -> None:
    team = _crear_team(red.b)
    _guardar(red.b, team, 2, nombre="Segundo")
    _guardar(red.b, team, 4, nombre="Cuarto")
    cuerpo = _teams(red.a, red.b).json()
    [visto] = cuerpo["teams"]
    assert (visto["grupo_id"], visto["portada_slot"]) == (None, 2)
    assert cuerpo["grupos"] == []


def test_la_portada_elegida_del_team_llega_como_portada_efectiva(red: Red) -> None:
    team = _crear_team(red.b)
    _guardar(red.b, team, 1)
    _guardar(red.b, team, 3, nombre="Tercero")
    red.b.api.patch(f"/api/teams/{team}", json={"portada_slot": 3})
    assert _teams(red.a, red.b).json()["teams"][0]["portada_slot"] == 3


def test_un_grupo_llega_con_sus_teams_visibles_y_sin_campos_del_duenio(red: Red) -> None:
    grupo = _crear_grupo(red.b, "Buildeado")
    principal, torre = _crear_team(red.b, "Principal"), _crear_team(red.b, "Torre")
    _meter(red.b, grupo, principal)
    _meter(red.b, grupo, torre)
    [visto] = _grupos_vistos(red.a, red.b)
    assert visto == {
        "id": grupo,
        "nombre": "Buildeado",
        "orden": 1,
        "team_ids": [principal, torre],
        "portada_team_id": principal,
    }


def test_un_team_oculto_no_aparece_en_el_grupo(red: Red) -> None:
    grupo = _crear_grupo(red.b, "Buildeado")
    principal, jefes, torre = (_crear_team(red.b, n) for n in ("Principal", "Jefes", "Torre"))
    for team in (principal, jefes, torre):
        _meter(red.b, grupo, team)
    _ocultar(red.b, jefes)
    cuerpo = _teams(red.a, red.b).json()
    assert [g["team_ids"] for g in cuerpo["grupos"]] == [[principal, torre]]
    assert {t["id"] for t in cuerpo["teams"]} == {principal, torre}


def test_la_portada_elegida_visible_es_la_que_ve_el_amigo(red: Red) -> None:
    grupo = _crear_grupo(red.b, "Buildeado")
    principal, torre = _crear_team(red.b, "Principal"), _crear_team(red.b, "Torre")
    _meter(red.b, grupo, principal)
    _meter(red.b, grupo, torre)
    _elegir_portada_de_grupo(red.b, grupo, torre)
    [visto] = _grupos_vistos(red.a, red.b)
    assert visto["portada_team_id"] == torre


def test_si_la_portada_elegida_esta_oculta_se_usa_el_primero_de_los_visibles(red: Red) -> None:
    grupo = _crear_grupo(red.b, "Buildeado")
    principal, jefes, torre = (_crear_team(red.b, n) for n in ("Principal", "Jefes", "Torre"))
    for team in (principal, jefes, torre):
        _meter(red.b, grupo, team)
    _elegir_portada_de_grupo(red.b, grupo, jefes)
    _ocultar(red.b, jefes)
    [visto] = _grupos_vistos(red.a, red.b)
    assert visto["portada_team_id"] == principal


def test_los_grupos_vacios_o_solo_con_ocultos_no_se_listan(red: Red) -> None:
    solo_ocultos = _crear_grupo(red.b, "Pruebas")
    _crear_grupo(red.b, "Nuevo")
    oculto = _crear_team(red.b, "Oculto")
    _meter(red.b, solo_ocultos, oculto)
    _ocultar(red.b, oculto)
    assert _grupos_vistos(red.a, red.b) == []


def test_el_orden_de_los_grupos_es_el_del_duenio(red: Red) -> None:
    uno, dos = _crear_grupo(red.b, "Uno"), _crear_grupo(red.b, "Dos")
    _meter(red.b, uno, _crear_team(red.b, "A"))
    _meter(red.b, dos, _crear_team(red.b, "B"))
    red.b.api.put("/api/grupos/orden", json={"grupo_ids": [dos, uno]})
    assert [(g["nombre"], g["orden"]) for g in _grupos_vistos(red.a, red.b)] == [
        ("Dos", 1),
        ("Uno", 2),
    ]


def _vista_normalizada(lector: Persona, de: Persona, nombres: dict[str, str]) -> dict[str, Any]:
    cuerpo = _teams(lector, de).json()
    return {
        "teams": [
            {**t, "id": nombres[t["id"]], "grupo_id": nombres.get(t["grupo_id"])}
            for t in cuerpo["teams"]
        ],
        "grupos": [
            {
                **g,
                "id": nombres[g["id"]],
                "team_ids": [nombres[t] for t in g["team_ids"]],
                "portada_team_id": nombres[g["portada_team_id"]],
            }
            for g in cuerpo["grupos"]
        ],
    }


def test_la_vista_del_amigo_es_igual_a_la_que_tendria_si_los_ocultos_no_existieran(
    red: Red,
) -> None:
    buildeado, pruebas, vacio = (_crear_grupo(red.b, n) for n in ("Buildeado", "Pruebas", "Vacio"))
    visibles = {n: _crear_team(red.b, n) for n in ("Principal", "Torre")}
    ocultos = {n: _crear_team(red.b, n) for n in ("Jefes", "Secreto")}
    _guardar(red.b, visibles["Principal"], 1)
    for team in (visibles["Principal"], ocultos["Jefes"], visibles["Torre"]):
        _meter(red.b, buildeado, team)
    _meter(red.b, pruebas, ocultos["Secreto"])
    _elegir_portada_de_grupo(red.b, buildeado, ocultos["Jefes"])
    for team in ocultos.values():
        _ocultar(red.b, team)
    nombres = {v: k for k, v in {**visibles, **ocultos}.items()} | {
        buildeado: "Buildeado",
        pruebas: "Pruebas",
        vacio: "Vacio",
    }
    con_ocultos = _vista_normalizada(red.a, red.b, nombres)
    for team in ocultos.values():
        assert red.b.api.delete(f"/api/teams/{team}").status_code == 204
    sin_ocultos = _vista_normalizada(red.a, red.b, nombres)
    assert con_ocultos == sin_ocultos
    assert [g["team_ids"] for g in con_ocultos["grupos"]] == [["Principal", "Torre"]]


def test_la_respuesta_no_revela_campos_exclusivos_del_duenio(red: Red) -> None:
    grupo = _crear_grupo(red.b, "Buildeado")
    team = _crear_team(red.b)
    _meter(red.b, grupo, team)
    texto = json.dumps(_teams(red.a, red.b).json())
    for prohibido in ("oculto_para_amigos", "portada_efectiva_slot", "portada_efectiva_team_id"):
        assert prohibido not in texto


# --- el orden que ve el amigo no tiene huecos ---


def test_los_grupos_visibles_se_renumeran_sin_huecos(red: Red) -> None:
    primero, oculto, tercero = (_crear_grupo(red.b, n) for n in ("Uno", "Oculto", "Tres"))
    _meter(red.b, primero, _crear_team(red.b, "A"))
    solo_oculto = _crear_team(red.b, "B")
    _meter(red.b, oculto, solo_oculto)
    _ocultar(red.b, solo_oculto)
    _meter(red.b, tercero, _crear_team(red.b, "C"))
    assert [(g["nombre"], g["orden"]) for g in _grupos_vistos(red.a, red.b)] == [
        ("Uno", 1),
        ("Tres", 2),
    ]


def test_los_teams_visibles_se_renumeran_sin_huecos(red: Red) -> None:
    uno = _crear_team(red.b, "Uno")
    oculto = _crear_team(red.b, "Oculto")
    tres = _crear_team(red.b, "Tres")
    _ocultar(red.b, oculto)
    cuerpo = _teams(red.a, red.b).json()
    assert [(t["id"], t["orden"]) for t in cuerpo["teams"]] == [(uno, 1), (tres, 2)]


def test_la_renumeracion_conserva_el_orden_relativo_de_grupos_y_sueltos(red: Red) -> None:
    grupo = _crear_grupo(red.b, "Buildeado")
    a, oculto, b, suelto = (_crear_team(red.b, n) for n in ("A", "Oculto", "B", "Suelto"))
    _meter(red.b, grupo, a)
    _meter(red.b, grupo, b)
    red.b.api.put(f"/api/grupos/{grupo}/orden", json={"team_ids": [b, a]})
    _ocultar(red.b, oculto)
    cuerpo = _teams(red.a, red.b).json()
    assert [t["orden"] for t in cuerpo["teams"]] == [1, 2, 3]
    assert [g["team_ids"] for g in cuerpo["grupos"]] == [[b, a]]
    por_id = {t["id"]: t["orden"] for t in cuerpo["teams"]}
    assert por_id[b] < por_id[a]
    assert suelto in por_id


def test_el_duenio_sigue_viendo_los_ordenes_originales(red: Red) -> None:
    primero, oculto = _crear_grupo(red.b, "Uno"), _crear_grupo(red.b, "Oculto")
    tercero = _crear_grupo(red.b, "Tres")
    for grupo in (primero, tercero):
        _meter(red.b, grupo, _crear_team(red.b))
    team_oculto = _crear_team(red.b, "Oculto")
    _meter(red.b, oculto, team_oculto)
    _ocultar(red.b, team_oculto)
    propio = red.b.api.get("/api/teams").json()
    assert [g["orden"] for g in propio["grupos"]] == [1, 2, 3]
    assert [t["orden"] for t in propio["teams"]] == [1, 2, 3]
