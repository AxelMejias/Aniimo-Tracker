from dataclasses import replace
from datetime import date

import pytest

from app.domain.catalogos import Stat
from app.domain.crecimiento import Catalogo, Confianza
from app.domain.potencial import (
    EntradaDePotencial,
    NotaDePotencialDeObjeto,
    ObjetoEquipado,
    ViaDespertar,
    avisos_de_version,
    calcular_cupo_de_despertar,
    calcular_potencial_efectivo,
    desglosar_personalidad,
)
from app.infrastructure.catalogo_crecimiento import RUTA_POR_DEFECTO, leer_catalogo
from tests.catalogo_de_ejemplo import catalogo_de_ejemplo, parametros_de_potencial, potenciales


def catalogo_del_repo() -> Catalogo:
    catalogo = leer_catalogo(RUTA_POR_DEFECTO)
    assert isinstance(catalogo, Catalogo)
    return catalogo


def entrada_de_potencial(
    *,
    nivel: int = 60,
    etapa_estrella: int = 0,
    personalidad: str | None = None,
    objeto_equipado: ObjetoEquipado | None = None,
    despertares_usados: int = 0,
    despertares_total: int = 0,
    fecha_parche: date | None = None,
    **puntos: int,
) -> EntradaDePotencial:
    return EntradaDePotencial(
        nivel=nivel,
        etapa_estrella=etapa_estrella,
        potenciales=potenciales(**puntos),
        personalidad=personalidad,
        objeto_equipado=objeto_equipado,
        despertares_usados=despertares_usados,
        despertares_total=despertares_total,
        fecha_parche=fecha_parche,
    )


IRISALIS = {
    "nivel": 60,
    "etapa_estrella": 6,
    "personalidad": "ENFJ",
    "despertares_usados": 28,
    "despertares_total": 43,
    "ps": 11,
    "atq": 20,
    "def_fisica": 5,
    "def_magica": 4,
    "regen": 20,
    "quiebre": 6,
}

INFERGON = {
    "nivel": 1,
    "etapa_estrella": 0,
    "personalidad": "INFJ",
    "despertares_usados": 0,
    "despertares_total": 5,
    "ps": 4,
    "atq": 8,
    "def_fisica": 4,
    "def_magica": 5,
    "regen": 8,
    "quiebre": 3,
}


def test_p1_irisalis_con_bono_de_estrella() -> None:
    resultado = calcular_potencial_efectivo(catalogo_del_repo(), entrada_de_potencial(**IRISALIS))

    assert resultado.potencial is not None
    stats = resultado.potencial.stats
    assert all(stats[stat].bono_estrella == 2 for stat in Stat)
    ps = stats[Stat.PS]
    assert (ps.n, ps.saltos, ps.proximo_salto, ps.puntos_al_proximo) == (13, 3, 16, 3)
    assert ps.via_despertar is ViaDespertar.SI
    atq = stats[Stat.ATQ]
    assert (atq.n, atq.saltos, atq.puntos_al_proximo) == (22, 5, 2)
    assert atq.via_despertar is ViaDespertar.TOPE
    regen = stats[Stat.REGEN]
    assert (regen.n, regen.saltos, regen.puntos_al_proximo) == (22, 5, 2)
    assert regen.via_despertar is ViaDespertar.TOPE
    assert (stats[Stat.DEF_FISICA].n, stats[Stat.DEF_FISICA].puntos_al_proximo) == (7, 1)
    assert (stats[Stat.DEF_MAGICA].n, stats[Stat.DEF_MAGICA].puntos_al_proximo) == (6, 2)
    quiebre = stats[Stat.QUIEBRE]
    assert (quiebre.n, quiebre.saltos, quiebre.puntos_al_proximo) == (8, 2, 4)
    assert quiebre.via_despertar is ViaDespertar.SI


def test_p1_porcentajes_de_cada_parte() -> None:
    resultado = calcular_potencial_efectivo(catalogo_del_repo(), entrada_de_potencial(**IRISALIS))

    assert resultado.potencial is not None
    ps = resultado.potencial.stats[Stat.PS]
    assert (ps.porcentaje_por_puntos, ps.porcentaje_por_saltos) == (
        parametros_de_potencial().por_punto * 13,
        12,
    )


def test_p1_parametros_y_confianza_viajan_con_el_resultado() -> None:
    resultado = calcular_potencial_efectivo(catalogo_del_repo(), entrada_de_potencial(**IRISALIS))

    assert resultado.potencial is not None
    assert resultado.potencial.confianza is Confianza.MEDIDO
    assert resultado.potencial.salto_cada == 4
    assert resultado.potencial.cuenta_estrella is True
    assert resultado.potencial.cuenta_objeto is True


def test_p2_linea_base_del_infergon() -> None:
    resultado = calcular_potencial_efectivo(catalogo_del_repo(), entrada_de_potencial(**INFERGON))

    assert resultado.potencial is not None
    stats = resultado.potencial.stats
    assert all(stats[stat].bono_estrella == 0 for stat in Stat)
    for stat in (Stat.ATQ, Stat.REGEN):
        assert (stats[stat].n, stats[stat].saltos, stats[stat].puntos_al_proximo) == (8, 2, 4)
        assert stats[stat].via_despertar is ViaDespertar.SI
    quiebre = stats[Stat.QUIEBRE]
    assert (quiebre.n, quiebre.saltos, quiebre.puntos_al_proximo) == (3, 0, 1)


@pytest.mark.parametrize("n", range(25))
def test_p3_conteo_de_saltos_de_0_a_24(n: int) -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(), entrada_de_potencial(etapa_estrella=0, atq=min(n, 20))
    )

    assert resultado.potencial is not None
    atq = resultado.potencial.stats[Stat.ATQ]
    if n <= 20:
        assert atq.n == n
        assert atq.saltos == n // 4
        assert atq.proximo_salto == (n // 4 + 1) * 4
        assert atq.puntos_al_proximo == atq.proximo_salto - n


def test_p3_extremos_del_conteo() -> None:
    catalogo = catalogo_de_ejemplo()

    cero = calcular_potencial_efectivo(catalogo, entrada_de_potencial()).potencial
    tres = calcular_potencial_efectivo(catalogo, entrada_de_potencial(atq=3)).potencial
    veinte = calcular_potencial_efectivo(catalogo, entrada_de_potencial(atq=20)).potencial

    assert cero is not None and tres is not None and veinte is not None
    assert (cero.stats[Stat.ATQ].saltos, cero.stats[Stat.ATQ].puntos_al_proximo) == (0, 4)
    assert (tres.stats[Stat.ATQ].saltos, tres.stats[Stat.ATQ].puntos_al_proximo) == (0, 1)
    assert (veinte.stats[Stat.ATQ].saltos, veinte.stats[Stat.ATQ].puntos_al_proximo) == (5, 4)


def test_n_mas_alto_que_20_por_estrellas_no_se_topa() -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(), entrada_de_potencial(etapa_estrella=7, atq=20)
    )

    assert resultado.potencial is not None
    assert resultado.potencial.stats[Stat.ATQ].n == 24
    assert resultado.potencial.stats[Stat.ATQ].saltos == 6


def test_p5_sin_cupo_de_despertar() -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(),
        entrada_de_potencial(atq=18, despertares_usados=43, despertares_total=43),
    )

    assert resultado.potencial is not None
    atq = resultado.potencial.stats[Stat.ATQ]
    assert atq.puntos_al_proximo == 2
    assert atq.via_despertar is ViaDespertar.SIN_CUPO


def test_p5_triangulado_con_cupo_justo() -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(),
        entrada_de_potencial(atq=18, despertares_usados=41, despertares_total=43),
    )

    assert resultado.potencial is not None
    assert resultado.potencial.stats[Stat.ATQ].via_despertar is ViaDespertar.SI


def test_tope_gana_sobre_sin_cupo() -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(),
        entrada_de_potencial(atq=20, despertares_usados=5, despertares_total=5),
    )

    assert resultado.potencial is not None
    assert resultado.potencial.stats[Stat.ATQ].via_despertar is ViaDespertar.TOPE


def test_estrella_que_no_cuenta() -> None:
    catalogo = catalogo_de_ejemplo(potencial=parametros_de_potencial(cuenta_estrella=False))

    resultado = calcular_potencial_efectivo(catalogo, entrada_de_potencial(**IRISALIS))

    assert resultado.potencial is not None
    assert resultado.potencial.stats[Stat.PS].bono_estrella == 0
    assert resultado.potencial.stats[Stat.PS].n == 11


def test_objeto_con_bono_de_potencial() -> None:
    objeto = ObjetoEquipado("ejemplo-objeto-x", 2)

    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(), entrada_de_potencial(atq=10, objeto_equipado=objeto)
    )

    assert resultado.potencial is not None
    atq = resultado.potencial.stats[Stat.ATQ]
    assert (atq.bono_objeto, atq.n) == (2, 12)
    assert resultado.potencial.stats[Stat.PS].bono_objeto == 0
    assert resultado.objeto is not None
    assert (resultado.objeto.aplicado, resultado.objeto.nota) == (True, None)


def test_objeto_bajo_su_nivel_minimo_o_con_cuenta_objeto_en_false_no_suma() -> None:
    bajo = calcular_potencial_efectivo(
        catalogo_de_ejemplo(),
        entrada_de_potencial(atq=10, objeto_equipado=ObjetoEquipado("ejemplo-objeto-x", 1)),
    )
    apagado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(potencial=parametros_de_potencial(cuenta_objeto=False)),
        entrada_de_potencial(atq=10, objeto_equipado=ObjetoEquipado("ejemplo-objeto-x", 2)),
    )

    assert bajo.potencial is not None and apagado.potencial is not None
    assert bajo.potencial.stats[Stat.ATQ].bono_objeto == 0
    assert apagado.potencial.stats[Stat.ATQ].bono_objeto == 0
    assert (
        bajo.objeto is not None
        and bajo.objeto.nota is NotaDePotencialDeObjeto.SIN_BONO_DE_POTENCIAL
    )
    assert apagado.objeto is not None
    assert apagado.objeto.nota is NotaDePotencialDeObjeto.SIN_BONO_DE_POTENCIAL


def test_catalogo_sin_potencial_da_resultado_nulo_y_lo_informa() -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(potencial=None), entrada_de_potencial(atq=10)
    )

    assert resultado.potencial is None
    assert "potencial" in resultado.sin_datos
    assert resultado.despertar is not None


@pytest.mark.parametrize(
    ("nivel", "etapa", "esperado"),
    [(1, 0, 5), (44, 0, 5), (45, 0, 10), (55, 0, 20), (60, 0, 30), (65, 0, 30), (65, 7, 53)],
)
def test_p4_cupo_sugerido_por_nivel_y_etapa(nivel: int, etapa: int, esperado: int) -> None:
    cupo = calcular_cupo_de_despertar(catalogo_del_repo(), nivel, etapa, 0, 0)

    assert cupo is not None
    assert cupo.cupo_sugerido == esperado


def test_cupo_de_irisalis_con_desglose() -> None:
    resultado = calcular_potencial_efectivo(catalogo_del_repo(), entrada_de_potencial(**IRISALIS))

    cupo = resultado.despertar
    assert cupo is not None
    assert cupo.cupo_sugerido == 43
    assert (cupo.total_cargado, cupo.diferencia, cupo.restantes) == (43, 0, 15)
    assert [(t.origen, t.detalle, t.suma) for t in cupo.desglose] == [
        ("nivel", "nivel 1", 5),
        ("nivel", "nivel 45", 5),
        ("nivel", "nivel 55", 10),
        ("nivel", "nivel 60", 10),
        ("etapa", "etapa 5", 5),
        ("etapa", "etapa 6", 8),
    ]
    assert cupo.confianza is Confianza.MEDIDO


def test_diferencia_negativa_cuando_lo_cargado_supera_el_sugerido() -> None:
    cupo = calcular_cupo_de_despertar(catalogo_del_repo(), 60, 0, 10, 35)

    assert cupo is not None
    assert (cupo.cupo_sugerido, cupo.diferencia, cupo.restantes) == (30, -5, 25)


def test_sin_seccion_despertar_el_cupo_es_nulo() -> None:
    catalogo = catalogo_de_ejemplo(despertar=None)

    resultado = calcular_potencial_efectivo(catalogo, entrada_de_potencial(atq=4))

    assert resultado.despertar is None
    assert "despertar" in resultado.sin_datos


def test_sin_etapas_de_estrella_el_cupo_solo_usa_el_nivel() -> None:
    catalogo = catalogo_de_ejemplo(etapas_de_estrella=None)

    cupo = calcular_cupo_de_despertar(catalogo, 60, 7, 0, 0)

    assert cupo is not None
    assert cupo.cupo_sugerido == 30


def test_personalidad_enfj() -> None:
    slots = desglosar_personalidad(catalogo_del_repo(), "ENFJ")

    assert slots is not None
    assert [(s.letra, s.nombre, s.letra_confirmada) for s in slots] == [
        ("E", "Energetic", True),
        ("N", "Nimble", True),
        ("F", "Faithful", False),
        ("J", "Judicious", False),
    ]
    assert [(b.stat, b.porcentaje) for b in slots[0].bonos] == [(Stat.ATQ, 2), (Stat.QUIEBRE, 2)]
    assert [(b.stat, b.descripcion, b.porcentaje) for b in slots[1].bonos] == [
        (None, "Prob. de crítico", 5)
    ]
    assert [(b.stat, b.porcentaje) for b in slots[2].bonos] == [(Stat.DEF_MAGICA, 6)]
    assert [(b.stat, b.porcentaje) for b in slots[3].bonos] == [(Stat.PS, 4)]
    assert all(s.confianza is Confianza.MEDIDO for s in slots)


def test_personalidad_infj_con_letra_inferida() -> None:
    slots = desglosar_personalidad(catalogo_del_repo(), "INFJ")

    assert slots is not None
    assert (slots[0].nombre, slots[0].letra_confirmada) == ("Instinctive", False)
    assert [(b.stat, b.porcentaje) for b in slots[0].bonos] == [(Stat.REGEN, 4)]


def test_letra_ausente_del_catalogo_devuelve_el_slot_vacio() -> None:
    slots = desglosar_personalidad(catalogo_de_ejemplo(), "ENFP")

    assert slots is not None
    cuarto = slots[3]
    assert (cuarto.letra, cuarto.nombre, cuarto.bonos, cuarto.confianza) == ("P", None, (), None)
    assert cuarto.letra_confirmada is False


def test_sin_personalidad_el_desglose_es_nulo() -> None:
    assert desglosar_personalidad(catalogo_de_ejemplo(), None) is None
    resultado = calcular_potencial_efectivo(catalogo_de_ejemplo(), entrada_de_potencial())
    assert resultado.personalidad is None


def test_catalogo_sin_personalidad_da_desglose_nulo_y_lo_informa() -> None:
    catalogo = catalogo_de_ejemplo(personalidad=None)

    resultado = calcular_potencial_efectivo(catalogo, entrada_de_potencial(personalidad="ENFJ"))

    assert resultado.personalidad is None
    assert "personalidad" in resultado.sin_datos


def test_p6_ficha_sin_fecha_es_version_desconocida_con_todos_los_avisos() -> None:
    catalogo = catalogo_de_ejemplo()

    desconocida, avisos = avisos_de_version(catalogo, None)

    assert desconocida is True
    assert [a.fecha for a in avisos] == [date(2026, 9, 23)]


def test_p6_ficha_anterior_a_un_cambio() -> None:
    desconocida, avisos = avisos_de_version(catalogo_de_ejemplo(), date(2026, 9, 1))

    assert desconocida is False
    assert [a.descripcion for a in avisos] == ["Actualizacion del 23/09"]


@pytest.mark.parametrize("fecha", [date(2026, 9, 23), date(2026, 12, 1)])
def test_p6_ficha_al_dia_no_tiene_avisos(fecha: date) -> None:
    desconocida, avisos = avisos_de_version(catalogo_de_ejemplo(), fecha)

    assert desconocida is False
    assert avisos == ()


def test_p6_solo_avisa_los_cambios_posteriores_a_la_ficha() -> None:
    uno = replace(catalogo_de_ejemplo().cambios_conocidos[0], fecha=date(2026, 8, 1))
    dos = replace(uno, fecha=date(2026, 9, 23))
    tres = replace(uno, fecha=date(2026, 11, 1))
    catalogo = catalogo_de_ejemplo(cambios_conocidos=(uno, dos, tres))

    _, avisos = avisos_de_version(catalogo, date(2026, 9, 23))

    assert [a.fecha for a in avisos] == [date(2026, 11, 1)]


def test_resultado_completo_lleva_la_version_y_los_avisos() -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(), entrada_de_potencial(fecha_parche=date(2026, 9, 1))
    )

    assert resultado.version_desconocida is False
    assert len(resultado.avisos) == 1
    assert resultado.sin_datos == ()


@pytest.mark.parametrize(
    ("objeto", "nota"),
    [
        (ObjetoEquipado(None, 1), NotaDePotencialDeObjeto.SIN_ELEGIR),
        (ObjetoEquipado("no-existe", 1), NotaDePotencialDeObjeto.OBJETO_DESCONOCIDO),
        (ObjetoEquipado("ejemplo-objeto-y", 5), NotaDePotencialDeObjeto.SIN_BONO_DE_POTENCIAL),
    ],
)
def test_notas_del_objeto(objeto: ObjetoEquipado, nota: NotaDePotencialDeObjeto) -> None:
    resultado = calcular_potencial_efectivo(
        catalogo_de_ejemplo(), entrada_de_potencial(atq=10, objeto_equipado=objeto)
    )

    assert resultado.objeto is not None
    assert (resultado.objeto.aplicado, resultado.objeto.nota) == (False, nota)
    assert resultado.potencial is not None
    assert all(s.bono_objeto == 0 for s in resultado.potencial.stats.values())


def test_sin_objeto_equipado_el_resultado_del_objeto_es_nulo() -> None:
    resultado = calcular_potencial_efectivo(catalogo_de_ejemplo(), entrada_de_potencial())

    assert resultado.objeto is None


def test_el_calculo_no_depende_de_estrella_actual_ni_del_reloj() -> None:
    primero = calcular_potencial_efectivo(
        catalogo_de_ejemplo(), entrada_de_potencial(fecha_parche=date(2026, 9, 1))
    )
    segundo = calcular_potencial_efectivo(
        catalogo_de_ejemplo(), entrada_de_potencial(fecha_parche=date(2026, 9, 1))
    )

    assert primero == segundo
    assert not hasattr(EntradaDePotencial, "estrella_actual")
