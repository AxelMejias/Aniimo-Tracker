import dataclasses
from collections.abc import Callable
from uuid import uuid4

import pytest

from app.domain.catalogos import PosicionObjeto, Rareza, Stat
from app.domain.entidades import (
    AniimoDelTeam,
    MaterialEstrella,
    ObjetoTransportado,
    ValoresDeStat,
)
from app.domain.errores import (
    DespertaresInconsistentes,
    ErrorDeValidacion,
    PersonalidadInvalida,
    PotencialFueraDeRango,
    SlotInvalido,
    ValorInvalido,
)

PERSONALIDADES = [f"{a}{b}{c}{d}" for a in "EI" for b in "NS" for c in "TF" for d in "JP"]


def _aniimo(**cambios: object) -> AniimoDelTeam:
    base: dict[str, object] = {"team_id": uuid4(), "slot": 1, "nombre": "Irisalis"}
    return AniimoDelTeam(**{**base, **cambios})  # type: ignore[arg-type]


@pytest.mark.parametrize("potencial", [0, 10, 20])
def test_valores_de_stat_acepta_potencial_de_0_a_20(potencial: int) -> None:
    assert ValoresDeStat(potencial=potencial).potencial == potencial


@pytest.mark.parametrize("potencial", [-1, 21, 100])
def test_valores_de_stat_rechaza_potencial_fuera_de_rango(potencial: int) -> None:
    with pytest.raises(PotencialFueraDeRango):
        ValoresDeStat(potencial=potencial)


@pytest.mark.parametrize(
    ("campo", "valor"),
    [("valor_actual", -5), ("bono_estrellas_incluido", -1)],
)
def test_valores_de_stat_rechaza_negativos(campo: str, valor: int) -> None:
    with pytest.raises(ValorInvalido) as info:
        ValoresDeStat(**{campo: valor})  # type: ignore[arg-type]
    assert campo in str(info.value)


def test_valores_de_stat_por_defecto_son_cero_y_sin_notas() -> None:
    valores = ValoresDeStat()
    assert (valores.valor_actual, valores.potencial, valores.bono_estrellas_incluido) == (0, 0, 0)
    assert valores.notas is None


def test_replace_de_valores_de_stat_falla_igual_que_la_construccion() -> None:
    with pytest.raises(PotencialFueraDeRango):
        dataclasses.replace(ValoresDeStat(), potencial=21)


@pytest.mark.parametrize("posicion", [1, 2, 3])
def test_material_acepta_posiciones_de_1_a_3(posicion: int) -> None:
    assert MaterialEstrella(posicion=posicion, nombre="Polvo").posicion == posicion


@pytest.mark.parametrize("posicion", [0, 4])
def test_material_rechaza_posicion_fuera_de_rango(posicion: int) -> None:
    with pytest.raises(ValorInvalido):
        MaterialEstrella(posicion=posicion, nombre="Polvo")


def test_material_permite_tengo_mayor_que_necesito() -> None:
    material = MaterialEstrella(posicion=1, nombre="Polvo", tengo=413, necesito=60)
    assert material.tengo > material.necesito


@pytest.mark.parametrize("cambios", [{"nombre": ""}, {"tengo": -1}, {"necesito": -1}])
def test_material_rechaza_nombre_vacio_y_cantidades_negativas(cambios: dict[str, object]) -> None:
    base: dict[str, object] = {"posicion": 1, "nombre": "Polvo"}
    with pytest.raises(ValorInvalido):
        MaterialEstrella(**{**base, **cambios})  # type: ignore[arg-type]


def test_objeto_con_nivel_cero_falla() -> None:
    with pytest.raises(ValorInvalido) as info:
        ObjetoTransportado(
            posicion=PosicionObjeto.EQUIPADO, nombre="Anillo", rareza=Rareza.RARA, nivel=0
        )
    assert "nivel" in str(info.value)


def test_objeto_con_nombre_vacio_falla() -> None:
    with pytest.raises(ValorInvalido):
        ObjetoTransportado(posicion=PosicionObjeto.EQUIPADO, nombre="", rareza=Rareza.RARA)


@pytest.mark.parametrize("rareza", list(Rareza))
def test_contrato_se_permite_en_cualquier_rareza(rareza: Rareza) -> None:
    objeto = ObjetoTransportado(
        posicion=PosicionObjeto.EQUIPADO, nombre="Anillo", rareza=rareza, nivel=3, contrato=True
    )
    assert objeto.contrato is True


def test_aniimo_minimo_tiene_los_defaults() -> None:
    aniimo = _aniimo()
    assert aniimo.nivel == 1
    assert aniimo.cp == 0
    assert set(aniimo.stats) == set(Stat)
    assert all(v == ValoresDeStat() for v in aniimo.stats.values())
    assert aniimo.elemento is None
    assert aniimo.rol is None
    assert aniimo.potencial_innato is None
    assert aniimo.personalidad is None
    assert aniimo.nivel_requerido_siguiente_etapa is None
    assert aniimo.notas is None
    assert aniimo.notas_habilidades is None
    assert aniimo.materiales == ()
    assert aniimo.objetos == ()
    assert (aniimo.despertares_usados, aniimo.despertares_total) == (0, 0)


@pytest.mark.parametrize("slot", [1, 2, 3, 4])
def test_aniimo_acepta_slots_de_1_a_4(slot: int) -> None:
    assert _aniimo(slot=slot).slot == slot


@pytest.mark.parametrize("slot", [0, 5])
def test_aniimo_con_slot_fuera_de_rango_es_slot_invalido(slot: int) -> None:
    with pytest.raises(SlotInvalido):
        _aniimo(slot=slot)


def test_aniimo_con_nombre_vacio_falla() -> None:
    with pytest.raises(ValorInvalido):
        _aniimo(nombre="")


@pytest.mark.parametrize(("campo", "valor"), [("nivel", 0), ("cp", -1)])
def test_aniimo_rechaza_nivel_y_cp_invalidos(campo: str, valor: int) -> None:
    with pytest.raises(ValorInvalido) as info:
        _aniimo(**{campo: valor})
    assert campo in str(info.value)


@pytest.mark.parametrize("nivel", [1, 60, 61, 100])
def test_aniimo_no_tiene_tope_de_nivel(nivel: int) -> None:
    assert _aniimo(nivel=nivel).nivel == nivel


@pytest.mark.parametrize("personalidad", PERSONALIDADES)
def test_aniimo_acepta_las_16_personalidades(personalidad: str) -> None:
    assert _aniimo(personalidad=personalidad).personalidad == personalidad


def test_hay_exactamente_16_personalidades() -> None:
    assert len(set(PERSONALIDADES)) == 16


@pytest.mark.parametrize("personalidad", ["EEFJ", "enfj", "ENF", "NEFJ", "ENFJX", ""])
def test_aniimo_rechaza_personalidades_invalidas(personalidad: str) -> None:
    with pytest.raises(PersonalidadInvalida):
        _aniimo(personalidad=personalidad)


@pytest.mark.parametrize(("usados", "total"), [(28, 43), (43, 43), (0, 0)])
def test_despertares_consistentes_se_aceptan(usados: int, total: int) -> None:
    aniimo = _aniimo(despertares_usados=usados, despertares_total=total)
    assert (aniimo.despertares_usados, aniimo.despertares_total) == (usados, total)


def test_despertares_usados_mayor_que_total_falla() -> None:
    with pytest.raises(DespertaresInconsistentes):
        _aniimo(despertares_usados=44, despertares_total=43)


@pytest.mark.parametrize(
    "campo",
    [
        "estrella_actual",
        "ganancia_despertar",
        "ganancia_seis_potenciales",
        "despertares_usados",
        "despertares_total",
    ],
)
def test_entrenamiento_rechaza_negativos(campo: str) -> None:
    with pytest.raises(ValorInvalido) as info:
        _aniimo(**{campo: -1})
    assert campo in str(info.value)


def test_nivel_requerido_de_siguiente_etapa_debe_ser_al_menos_1() -> None:
    assert _aniimo(nivel_requerido_siguiente_etapa=65).nivel_requerido_siguiente_etapa == 65
    with pytest.raises(ValorInvalido):
        _aniimo(nivel_requerido_siguiente_etapa=0)


def test_aniimo_con_cinco_stats_falla() -> None:
    stats = {stat: ValoresDeStat() for stat in Stat if stat is not Stat.QUIEBRE}
    with pytest.raises(ValorInvalido) as info:
        _aniimo(stats=stats)
    assert "stats" in str(info.value)


def test_aniimo_acepta_stats_personalizados() -> None:
    stats = {stat: ValoresDeStat(valor_actual=10) for stat in Stat}
    assert _aniimo(stats=stats).stats[Stat.PS].valor_actual == 10


def test_stats_del_aniimo_no_se_pueden_modificar_desde_afuera() -> None:
    aniimo = _aniimo()
    with pytest.raises(TypeError):
        aniimo.stats[Stat.PS] = ValoresDeStat(valor_actual=1)  # type: ignore[index]


def test_aniimos_con_los_mismos_datos_son_iguales() -> None:
    team_id = uuid4()
    identificador = uuid4()
    uno = AniimoDelTeam(team_id=team_id, slot=1, nombre="A", id=identificador)
    otro = AniimoDelTeam(team_id=team_id, slot=1, nombre="A", id=identificador)
    assert uno == otro


def test_aniimo_con_cuatro_materiales_falla() -> None:
    materiales = tuple(MaterialEstrella(posicion=1 + i % 3, nombre=f"M{i}") for i in range(4))
    with pytest.raises(ValorInvalido):
        _aniimo(materiales=materiales)


def test_aniimo_con_materiales_en_la_misma_posicion_falla() -> None:
    materiales = (
        MaterialEstrella(posicion=1, nombre="A"),
        MaterialEstrella(posicion=1, nombre="B"),
    )
    with pytest.raises(ValorInvalido):
        _aniimo(materiales=materiales)


def test_aniimo_acepta_tres_materiales_en_posiciones_distintas() -> None:
    materiales = tuple(MaterialEstrella(posicion=i, nombre=f"M{i}") for i in (1, 2, 3))
    assert len(_aniimo(materiales=materiales).materiales) == 3


def test_aniimo_con_dos_objetos_equipados_falla() -> None:
    objetos = (
        ObjetoTransportado(posicion=PosicionObjeto.EQUIPADO, nombre="A", rareza=Rareza.RARA),
        ObjetoTransportado(posicion=PosicionObjeto.EQUIPADO, nombre="B", rareza=Rareza.EPICA),
    )
    with pytest.raises(ValorInvalido):
        _aniimo(objetos=objetos)


def test_aniimo_acepta_un_objeto_equipado_y_uno_alternativo() -> None:
    objetos = (
        ObjetoTransportado(posicion=PosicionObjeto.EQUIPADO, nombre="A", rareza=Rareza.RARA),
        ObjetoTransportado(posicion=PosicionObjeto.ALTERNATIVO, nombre="B", rareza=Rareza.EPICA),
    )
    assert len(_aniimo(objetos=objetos).objetos) == 2


def test_replace_del_aniimo_revalida_los_campos_propios() -> None:
    aniimo = _aniimo()
    with pytest.raises(SlotInvalido):
        dataclasses.replace(aniimo, slot=5)
    with pytest.raises(PersonalidadInvalida):
        dataclasses.replace(aniimo, personalidad="EEFJ")


def test_replace_del_aniimo_revalida_los_stats() -> None:
    aniimo = _aniimo()
    with pytest.raises(ValorInvalido):
        dataclasses.replace(aniimo, stats={Stat.PS: ValoresDeStat()})


def test_los_errores_de_validacion_comparten_base() -> None:
    with pytest.raises(ErrorDeValidacion):
        _aniimo(slot=9)


def test_irisalis_de_referencia_se_construye(irisalis: AniimoDelTeam) -> None:
    assert irisalis.nivel == 60
    assert irisalis.personalidad == "ENFJ"
    assert irisalis.elemento is None
    assert irisalis.stats[Stat.ATQ].potencial == 20
    assert [(m.tengo, m.necesito) for m in irisalis.materiales] == [(413, 60), (1, 2), (3, 10)]


@pytest.mark.parametrize(
    ("construir", "campo"),
    [
        (lambda: _aniimo(nivel=-999), "nivel"),
        (lambda: _aniimo(cp=-4321), "cp"),
        (lambda: ValoresDeStat(valor_actual=-7777), "valor_actual"),
        (lambda: MaterialEstrella(posicion=1, nombre="Polvo", tengo=-8888), "tengo"),
    ],
)
def test_los_mensajes_nombran_el_campo_y_no_incluyen_valores(
    construir: Callable[[], object], campo: str
) -> None:
    with pytest.raises(ValorInvalido) as info:
        construir()
    mensaje = str(info.value)
    assert campo in mensaje
    assert not any(ch.isdigit() for ch in mensaje)


@pytest.mark.parametrize(
    "construir",
    [
        lambda: _aniimo(slot=7654),
        lambda: ValoresDeStat(potencial=4321),
        lambda: _aniimo(personalidad="ZZZZ"),
        lambda: _aniimo(despertares_usados=9876, despertares_total=5),
    ],
)
def test_los_errores_especificos_no_filtran_valores(construir: Callable[[], object]) -> None:
    with pytest.raises(ErrorDeValidacion) as info:
        construir()
    mensaje = str(info.value)
    assert not any(valor in mensaje for valor in ("7654", "4321", "ZZZZ", "9876"))


def test_materiales_quedan_ordenados_por_posicion() -> None:
    materiales = tuple(MaterialEstrella(posicion=i, nombre=f"M{i}") for i in (3, 1, 2))
    assert [m.posicion for m in _aniimo(materiales=materiales).materiales] == [1, 2, 3]


def test_objetos_quedan_con_el_equipado_primero() -> None:
    alternativo = ObjetoTransportado(
        posicion=PosicionObjeto.ALTERNATIVO, nombre="B", rareza=Rareza.EPICA
    )
    equipado = ObjetoTransportado(posicion=PosicionObjeto.EQUIPADO, nombre="A", rareza=Rareza.RARA)
    assert _aniimo(objetos=(alternativo, equipado)).objetos == (equipado, alternativo)


def test_el_orden_de_entrada_de_hijos_no_afecta_la_igualdad() -> None:
    m1, m2 = (MaterialEstrella(posicion=i, nombre=f"M{i}") for i in (1, 2))
    base: dict[str, object] = {"team_id": uuid4(), "slot": 1, "nombre": "A", "id": uuid4()}
    assert AniimoDelTeam(**base, materiales=(m2, m1)) == AniimoDelTeam(  # type: ignore[arg-type]
        **base,  # type: ignore[arg-type]
        materiales=(m1, m2),
    )
