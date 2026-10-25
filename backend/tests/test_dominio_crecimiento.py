from dataclasses import replace
from decimal import Decimal

import pytest

from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    Catalogo,
    EtapaDeEstrella,
    FormulaDeCp,
    Interpolacion,
    NivelDeObjeto,
    NotaDeObjeto,
    ObjetoDelCatalogo,
    PuntoMedido,
    Redondeo,
    TipoDeTermino,
    calcular_sugerencia,
)
from app.domain.errores import EspecieDesconocida
from tests.catalogo_de_ejemplo import (
    PLANO,
    PORCENTAJE,
    base_de_ejemplo,
    catalogo_de_ejemplo,
    entrada,
    mod,
    objeto_alternativo,
    objeto_equipado,
)


def _con_base(catalogo: Catalogo, stat: Stat, *puntos: PuntoMedido) -> Catalogo:
    base = {**base_de_ejemplo(), stat: tuple(puntos)}
    especie = replace(catalogo.especies[0], base=base)
    return replace(catalogo, especies=(especie, *catalogo.especies[1:]))


def test_r1_nivel_medido_exacto() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=60))

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 690
    assert atq.aproximado is False
    assert atq.motivo is None
    assert [t.origen for t in atq.desglose] == ["base"]


def test_r1_triangulado_otro_stat_y_otro_nivel_medido() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=1))

    assert resultado.stats[Stat.PS].valor == 1000
    assert resultado.stats[Stat.QUIEBRE].valor == 80


def test_r2_nivel_interpolado_es_aproximado() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=30))

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 390
    assert atq.aproximado is True


def test_interpolacion_en_otro_tramo_con_tres_puntos() -> None:
    catalogo = _con_base(
        catalogo_de_ejemplo(),
        Stat.ATQ,
        PuntoMedido(1, 100),
        PuntoMedido(20, 200),
        PuntoMedido(60, 1000),
    )

    atq = calcular_sugerencia(catalogo, entrada(nivel=40)).stats[Stat.ATQ]

    assert atq.valor == 600
    assert atq.aproximado is True


def test_r3_potencial_estrella_y_personalidad() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(nivel=30, atq=10, estrella_actual=1, personalidad="ENFJ")
    )

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 458
    assert [(t.origen, t.detalle) for t in atq.desglose] == [
        ("base", "nivel 30"),
        ("potencial", "potencial 10"),
        ("estrella", "estrella 1"),
        ("personalidad", "E"),
    ]


def test_redondeo_cercano_y_arriba_dan_459() -> None:
    for redondeo in (Redondeo.CERCANO, Redondeo.ARRIBA):
        catalogo = catalogo_de_ejemplo(redondeo=redondeo)
        resultado = calcular_sugerencia(
            catalogo, entrada(nivel=30, atq=10, estrella_actual=1, personalidad="ENFJ")
        )
        assert resultado.stats[Stat.ATQ].valor == 459


def test_redondeo_cercano_baja_cuando_la_fraccion_es_menor_a_la_mitad() -> None:
    catalogo = catalogo_de_ejemplo(redondeo=Redondeo.CERCANO)
    catalogo = replace(catalogo, potencial={Stat.ATQ: mod(PORCENTAJE, "0.3")})

    atq = calcular_sugerencia(catalogo, entrada(nivel=30, atq=1)).stats[Stat.ATQ]

    assert atq.valor == 391  # 390 * 1.003 = 391,17


def test_r4_nivel_fuera_de_lo_medido_no_se_extrapola() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=61))

    for stat in Stat:
        assert resultado.stats[stat].valor is None
        assert resultado.stats[stat].valor_con_objetos is None
        assert resultado.stats[stat].motivo == "fuera-de-rango"


def test_nivel_por_debajo_del_primer_punto_tambien_es_fuera_de_rango() -> None:
    catalogo = _con_base(
        catalogo_de_ejemplo(), Stat.ATQ, PuntoMedido(10, 100), PuntoMedido(60, 690)
    )

    atq = calcular_sugerencia(catalogo, entrada(nivel=5)).stats[Stat.ATQ]

    assert atq.valor is None
    assert atq.motivo == "fuera-de-rango"


def test_sin_interpolacion_un_nivel_no_medido_no_se_calcula() -> None:
    catalogo = catalogo_de_ejemplo(interpolacion=Interpolacion.NINGUNA)

    resultado = calcular_sugerencia(catalogo, entrada(nivel=30))

    assert resultado.stats[Stat.ATQ].valor is None
    assert resultado.stats[Stat.ATQ].motivo == "nivel-no-medido"


def test_sin_interpolacion_un_nivel_medido_se_calcula() -> None:
    catalogo = catalogo_de_ejemplo(interpolacion=Interpolacion.NINGUNA)

    atq = calcular_sugerencia(catalogo, entrada(nivel=60)).stats[Stat.ATQ]

    assert atq.valor == 690
    assert atq.aproximado is False


def test_r5_especie_desconocida() -> None:
    with pytest.raises(EspecieDesconocida):
        calcular_sugerencia(catalogo_de_ejemplo(), entrada(especie_id="no-existe"))


def test_r6_catalogo_sin_personalidad_lo_informa_y_calcula_el_resto() -> None:
    catalogo = catalogo_de_ejemplo(personalidad=None)

    resultado = calcular_sugerencia(
        catalogo, entrada(nivel=30, atq=10, estrella_actual=1, personalidad="ENFJ")
    )

    assert "personalidad" in resultado.sin_datos
    assert resultado.stats[Stat.ATQ].valor == 10 + int(Decimal(390) * Decimal("1.10"))


def test_sin_datos_lista_cada_seccion_ausente() -> None:
    catalogo = catalogo_de_ejemplo(
        potencial=None, estrellas=None, personalidad=None, objetos=None, cp=None
    )

    resultado = calcular_sugerencia(catalogo, entrada(nivel=60))

    assert resultado.sin_datos == ("potencial", "estrellas", "personalidad", "objetos", "cp")
    assert calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=60)).sin_datos == ()


def test_resultado_negativo_es_invalido() -> None:
    catalogo = catalogo_de_ejemplo(potencial={Stat.ATQ: mod(PLANO, -100)})

    atq = calcular_sugerencia(catalogo, entrada(nivel=1, atq=2)).stats[Stat.ATQ]

    assert atq.valor is None
    assert atq.motivo == "resultado-invalido"


def test_resultado_cero_es_valido() -> None:
    catalogo = catalogo_de_ejemplo(potencial={Stat.ATQ: mod(PLANO, -50)})

    atq = calcular_sugerencia(catalogo, entrada(nivel=1, atq=2)).stats[Stat.ATQ]

    assert atq.valor == 0


def test_varias_estrellas_acumulan_solo_hasta_la_actual() -> None:
    catalogo = catalogo_de_ejemplo()

    assert calcular_sugerencia(catalogo, entrada(estrella_actual=0)).stats[Stat.ATQ].valor == 690
    assert calcular_sugerencia(catalogo, entrada(estrella_actual=1)).stats[Stat.ATQ].valor == 700
    assert calcular_sugerencia(catalogo, entrada(estrella_actual=2)).stats[Stat.ATQ].valor == 720
    assert calcular_sugerencia(catalogo, entrada(estrella_actual=5)).stats[Stat.ATQ].valor == 720


def test_dos_letras_que_tocan_el_mismo_stat_se_suman() -> None:
    catalogo = catalogo_de_ejemplo(
        personalidad={
            "E": {Stat.ATQ: (mod(PORCENTAJE, 5),)},
            "N": {Stat.ATQ: (mod(PORCENTAJE, 3),)},
        }
    )

    resultado = calcular_sugerencia(catalogo, entrada(nivel=60, personalidad="ENFJ"))

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 690 + int(Decimal(690) * Decimal("0.08"))
    assert [t.detalle for t in atq.desglose if t.origen == "personalidad"] == ["E", "N"]


def test_un_stat_con_porcentaje_y_plano_a_la_vez() -> None:
    catalogo = catalogo_de_ejemplo(
        estrellas=(
            EtapaDeEstrella(
                estrella=1, modificadores={Stat.ATQ: (mod(PORCENTAJE, 10), mod(PLANO, 7))}
            ),
        )
    )

    atq = calcular_sugerencia(catalogo, entrada(nivel=60, estrella_actual=1)).stats[Stat.ATQ]

    assert atq.valor == 690 + 69 + 7


def test_potencial_plano_se_multiplica_por_los_puntos() -> None:
    ps = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=60, ps=15)).stats[Stat.PS]

    assert ps.valor == 6900 + 150
    termino = next(t for t in ps.desglose if t.origen == "potencial")
    assert termino.tipo == TipoDeTermino.PLANO
    assert termino.valor == Decimal(150)


def test_estrella_actual_cero_no_agrega_terminos() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(estrella_actual=0))

    assert all(t.origen != "estrella" for t in resultado.stats[Stat.ATQ].desglose)


def test_sin_objetos_valor_con_objetos_es_igual_a_valor() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=30, atq=10))

    for sugerido in resultado.stats.values():
        assert sugerido.valor_con_objetos == sugerido.valor


CASO_R3 = {"nivel": 30, "atq": 10, "estrella_actual": 1, "personalidad": "ENFJ"}


def test_r7_objeto_equipado_suma_sobre_el_valor_intermedio_sin_redondear() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto_equipado(),))
    )

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 458
    assert atq.valor_con_objetos == 509
    assert [(o.posicion, o.aplicado, o.nota) for o in resultado.objetos] == [
        (PosicionObjeto.EQUIPADO, True, None)
    ]
    assert [t.origen for t in atq.desglose].count("objeto") == 2
    assert any(t.detalle == "EJEMPLO Objeto X nivel 1" for t in atq.desglose)


def test_objeto_no_toca_los_stats_que_no_modifica() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto_equipado(),))
    )

    ps = resultado.stats[Stat.PS]
    assert ps.valor_con_objetos == ps.valor


def test_r8_objeto_alternativo_no_suma() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto_alternativo(),))
    )

    assert resultado.stats[Stat.ATQ].valor_con_objetos == 458
    assert [(o.aplicado, o.nota) for o in resultado.objetos] == [
        (False, NotaDeObjeto.ALTERNATIVO_NO_SUMA)
    ]


@pytest.mark.parametrize(
    ("objeto_id", "nivel", "nota"),
    [
        ("no-existe", 1, NotaDeObjeto.OBJETO_DESCONOCIDO),
        (None, 1, NotaDeObjeto.SIN_ELEGIR),
        ("ejemplo-objeto-x", 7, NotaDeObjeto.NIVEL_DE_OBJETO_SIN_DATOS),
    ],
)
def test_objeto_salteado_con_nota_y_el_resto_se_calcula(
    objeto_id: str | None, nivel: int, nota: NotaDeObjeto
) -> None:
    objeto = objeto_equipado(objeto_id, nivel)

    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto,)))

    assert resultado.stats[Stat.ATQ].valor == 458
    assert resultado.stats[Stat.ATQ].valor_con_objetos == 458
    assert [(o.aplicado, o.nota) for o in resultado.objetos] == [(False, nota)]


def test_equipado_y_alternativo_juntos_solo_suma_el_equipado() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(),
        entrada(**CASO_R3, objetos=(objeto_equipado(), objeto_alternativo("ejemplo-objeto-y"))),
    )

    assert resultado.stats[Stat.ATQ].valor_con_objetos == 509
    assert resultado.stats[Stat.PS].valor_con_objetos == resultado.stats[Stat.PS].valor
    assert [o.aplicado for o in resultado.objetos] == [True, False]


def test_catalogo_sin_objetos_lo_informa() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(objetos=None), entrada(**CASO_R3, objetos=(objeto_equipado(),))
    )

    assert "objetos" in resultado.sin_datos
    assert resultado.stats[Stat.ATQ].valor_con_objetos == resultado.stats[Stat.ATQ].valor == 458
    assert resultado.objetos[0].nota == NotaDeObjeto.OBJETO_DESCONOCIDO


def test_objeto_solo_plano_y_objeto_solo_porcentaje() -> None:
    plano = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(nivel=60, objetos=(objeto_equipado("ejemplo-objeto-y"),))
    )
    porcentaje = calcular_sugerencia(
        catalogo_de_ejemplo(),
        entrada(nivel=60, objetos=(objeto_equipado("ejemplo-objeto-y", nivel=2),)),
    )

    assert plano.stats[Stat.PS].valor_con_objetos == 6950
    assert porcentaje.stats[Stat.DEF_FISICA].valor_con_objetos == 340 + 13


def test_objeto_con_resultado_negativo_invalida_solo_la_variante_con_objetos() -> None:
    catalogo = catalogo_de_ejemplo(
        objetos=(
            ObjetoDelCatalogo(
                id="ejemplo-objeto-x",
                nombre="EJEMPLO Objeto X",
                niveles=(NivelDeObjeto(1, {Stat.ATQ: (mod(PLANO, -9999),)}),),
            ),
        )
    )

    atq = calcular_sugerencia(catalogo, entrada(nivel=60, objetos=(objeto_equipado(),))).stats[
        Stat.ATQ
    ]

    assert atq.valor == 690
    assert atq.valor_con_objetos is None
    assert atq.motivo == "resultado-invalido"


def _cp_100_atq_1_potencial_2() -> FormulaDeCp:
    return FormulaDeCp(
        constante=Decimal(100), pesos={Stat.ATQ: Decimal(1)}, por_punto_de_potencial=Decimal(2)
    )


def test_r9_cp_con_y_sin_objetos_usa_los_stats_redondeados() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(cp=_cp_100_atq_1_potencial_2()),
        entrada(**CASO_R3, objetos=(objeto_equipado(),)),
    )

    assert resultado.cp.valor == 578
    assert resultado.cp.valor_con_objetos == 629
    assert resultado.cp.motivo is None


def test_r10_sin_formula_de_cp() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(cp=None), entrada(**CASO_R3))

    assert resultado.cp.valor is None
    assert resultado.cp.valor_con_objetos is None
    assert resultado.cp.motivo == "sin-datos"
    assert "cp" in resultado.sin_datos
    assert resultado.stats[Stat.ATQ].valor == 458


def test_cp_con_stats_incompletos() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=61))

    assert resultado.cp.valor is None
    assert resultado.cp.valor_con_objetos is None
    assert resultado.cp.motivo == "stats-incompletos"


def test_cp_ignora_un_stat_sin_valor_si_no_tiene_peso() -> None:
    catalogo = _con_base(
        catalogo_de_ejemplo(cp=_cp_100_atq_1_potencial_2()),
        Stat.PS,
        PuntoMedido(1, 1000),
        PuntoMedido(10, 2000),
    )

    resultado = calcular_sugerencia(catalogo, entrada(nivel=30))

    assert resultado.stats[Stat.PS].valor is None
    assert resultado.cp.valor == 100 + 390

    con_peso = replace(
        catalogo, cp=FormulaDeCp(Decimal(0), {Stat.PS: Decimal(1), Stat.ATQ: Decimal(1)}, None)
    )
    assert calcular_sugerencia(con_peso, entrada(nivel=30)).cp.motivo == "stats-incompletos"


def test_cp_aproximado_si_un_stat_usado_es_interpolado() -> None:
    interpolado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=30)).cp
    exacto = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=60)).cp

    assert interpolado.aproximado is True
    assert exacto.aproximado is False


def test_cp_con_pesos_en_varios_stats_y_sin_puntos_de_potencial() -> None:
    formula = FormulaDeCp(
        constante=Decimal(0),
        pesos={Stat.ATQ: Decimal("0.5"), Stat.PS: Decimal("0.1")},
        por_punto_de_potencial=None,
    )

    resultado = calcular_sugerencia(catalogo_de_ejemplo(cp=formula), entrada(nivel=60, atq=3))

    assert resultado.cp.valor == int(Decimal("0.5") * 710 + Decimal("0.1") * 6900)
    assert [t.detalle for t in resultado.cp.desglose] == ["ps x 0.1", "atq x 0.5"]


def test_cp_constante_por_defecto_cero_y_potencial_suma_los_seis() -> None:
    formula = FormulaDeCp(constante=Decimal(0), pesos={}, por_punto_de_potencial=Decimal(3))

    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(cp=formula), entrada(nivel=60, atq=2, ps=5, regen=1)
    )

    assert resultado.cp.valor == 24
    assert [t.detalle for t in resultado.cp.desglose] == ["potencial x 3"]


def test_cp_respeta_el_redondeo_del_catalogo() -> None:
    formula = FormulaDeCp(Decimal(0), {Stat.ATQ: Decimal("0.33")}, None)

    abajo = calcular_sugerencia(catalogo_de_ejemplo(cp=formula), entrada(nivel=1))
    arriba = calcular_sugerencia(
        catalogo_de_ejemplo(cp=formula, redondeo=Redondeo.ARRIBA), entrada(nivel=1)
    )

    assert abajo.cp.valor == 33
    assert arriba.cp.valor == 33
    impar = FormulaDeCp(Decimal(0), {Stat.ATQ: Decimal("0.335")}, None)
    assert calcular_sugerencia(catalogo_de_ejemplo(cp=impar), entrada(nivel=1)).cp.valor == 33
    assert (
        calcular_sugerencia(
            catalogo_de_ejemplo(cp=impar, redondeo=Redondeo.ARRIBA), entrada(nivel=1)
        ).cp.valor
        == 34
    )


def test_cp_negativo_es_invalido() -> None:
    formula = FormulaDeCp(Decimal(-100000), {Stat.ATQ: Decimal(1)}, None)

    cp = calcular_sugerencia(catalogo_de_ejemplo(cp=formula), entrada(nivel=60)).cp

    assert cp.valor is None
    assert cp.motivo == "resultado-invalido"
