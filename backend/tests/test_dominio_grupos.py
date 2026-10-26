from dataclasses import replace
from uuid import uuid4

import pytest

from app.domain.entidades import (
    MAXIMO_DE_GRUPOS,
    MAXIMO_DE_TEAMS_POR_GRUPO,
    GrupoDeTeams,
    Team,
)
from app.domain.errores import (
    ErrorDeValidacion,
    LimiteDeGruposAlcanzado,
    OrdenDesactualizado,
    SlotInvalido,
    ValorInvalido,
)
from app.domain.grupos import portada_efectiva_de_grupo, portada_efectiva_de_team, repartir_orden


def test_los_maximos_de_grupos() -> None:
    assert (MAXIMO_DE_GRUPOS, MAXIMO_DE_TEAMS_POR_GRUPO) == (4, 5)


@pytest.mark.parametrize("orden", [1, 2, 3, MAXIMO_DE_GRUPOS])
def test_grupo_acepta_orden_de_1_al_maximo(orden: int) -> None:
    assert GrupoDeTeams(usuario_id=uuid4(), nombre="Buildeado", orden=orden).orden == orden


@pytest.mark.parametrize("orden", [0, -1, MAXIMO_DE_GRUPOS + 1])
def test_grupo_con_orden_fuera_de_rango_es_limite_de_grupos(orden: int) -> None:
    with pytest.raises(LimiteDeGruposAlcanzado):
        GrupoDeTeams(usuario_id=uuid4(), nombre="Buildeado", orden=orden)


def test_el_limite_de_grupos_es_un_error_de_validacion() -> None:
    assert issubclass(LimiteDeGruposAlcanzado, ErrorDeValidacion)


def test_grupo_con_nombre_vacio_falla() -> None:
    with pytest.raises(ValorInvalido) as info:
        GrupoDeTeams(usuario_id=uuid4(), nombre="", orden=1)
    assert "nombre" in str(info.value)


def test_grupo_nace_sin_portada_elegida_y_replace_la_cambia() -> None:
    grupo = GrupoDeTeams(usuario_id=uuid4(), nombre="Buildeado", orden=1)
    team_id = uuid4()
    assert grupo.portada_team_id is None
    assert replace(grupo, portada_team_id=team_id).portada_team_id == team_id


def test_team_nace_suelto_y_con_portada_automatica() -> None:
    team = Team(usuario_id=uuid4(), nombre="Raid", orden=1)
    assert (team.grupo_id, team.portada_slot) == (None, None)


def test_team_acepta_grupo_y_portada_y_replace_los_cambia() -> None:
    grupo_id = uuid4()
    team = Team(usuario_id=uuid4(), nombre="Raid", orden=1, grupo_id=grupo_id, portada_slot=3)
    assert (team.grupo_id, team.portada_slot) == (grupo_id, 3)
    assert replace(team, grupo_id=None, portada_slot=None).portada_slot is None


@pytest.mark.parametrize("slot", [0, 5, -1])
def test_team_con_portada_fuera_de_1_a_4_es_slot_invalido(slot: int) -> None:
    with pytest.raises(SlotInvalido):
        Team(usuario_id=uuid4(), nombre="Raid", orden=1, portada_slot=slot)


@pytest.mark.parametrize(
    ("elegida", "ocupados", "esperada"),
    [
        (3, [1, 3], 3),
        (2, [2, 4], 2),
        (None, [2, 4], 2),
        (None, [4, 3, 1], 1),
        (1, [4], 4),
        (3, [2, 4], 2),
        (None, [], None),
        (3, [], None),
    ],
)
def test_portada_efectiva_de_team(elegida: int | None, ocupados: list[int], esperada: int) -> None:
    assert portada_efectiva_de_team(elegida, ocupados) == esperada


def test_portada_efectiva_de_grupo_sin_elegir_es_el_primero_de_la_lista() -> None:
    primero, segundo, tercero = uuid4(), uuid4(), uuid4()
    assert portada_efectiva_de_grupo(None, [primero, segundo, tercero]) == primero


def test_portada_efectiva_de_grupo_respeta_la_elegida_que_esta_en_el_grupo() -> None:
    primero, segundo = uuid4(), uuid4()
    assert portada_efectiva_de_grupo(segundo, [primero, segundo]) == segundo


def test_portada_efectiva_de_grupo_ignora_una_elegida_que_no_esta_en_la_lista() -> None:
    primero, segundo = uuid4(), uuid4()
    assert portada_efectiva_de_grupo(uuid4(), [primero, segundo]) == primero


def test_portada_efectiva_de_grupo_vacio_es_none() -> None:
    assert portada_efectiva_de_grupo(None, []) is None
    assert portada_efectiva_de_grupo(uuid4(), []) is None


def test_repartir_orden_reparte_los_mismos_valores_en_el_orden_pedido() -> None:
    a, b, c = uuid4(), uuid4(), uuid4()
    assert repartir_orden({a: 2, b: 5, c: 9}, [c, a, b]) == {c: 2, a: 5, b: 9}


def test_repartir_orden_intercambia_dos() -> None:
    a, b = uuid4(), uuid4()
    assert repartir_orden({a: 1, b: 2}, [b, a]) == {b: 1, a: 2}


def test_repartir_orden_con_el_mismo_orden_no_cambia_nada() -> None:
    a, b, c = uuid4(), uuid4(), uuid4()
    actual = {a: 3, b: 7, c: 8}
    assert repartir_orden(actual, [a, b, c]) == actual


def test_repartir_orden_ordena_los_valores_aunque_el_diccionario_venga_desordenado() -> None:
    a, b = uuid4(), uuid4()
    assert repartir_orden({a: 9, b: 4}, [a, b]) == {a: 4, b: 9}


def test_repartir_orden_con_un_solo_elemento() -> None:
    a = uuid4()
    assert repartir_orden({a: 6}, [a]) == {a: 6}


@pytest.mark.parametrize("caso", ["falta", "sobra", "desconocido", "repetido", "vacio"])
def test_repartir_orden_con_lista_desactualizada_lanza_error(caso: str) -> None:
    a, b = uuid4(), uuid4()
    pedido = {
        "falta": [a],
        "sobra": [a, b, uuid4()],
        "desconocido": [a, uuid4()],
        "repetido": [a, a],
        "vacio": [],
    }[caso]
    with pytest.raises(OrdenDesactualizado):
        repartir_orden({a: 1, b: 2}, pedido)
