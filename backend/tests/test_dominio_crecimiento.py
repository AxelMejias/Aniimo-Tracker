from dataclasses import replace
from decimal import Decimal

import pytest

from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    BonoDePotencialDeObjeto,
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
    multiplicador_de_potencial,
)
from app.domain.errores import EspecieDesconocida
from tests.catalogo_de_ejemplo import (
    PLANO,
    PORCENTAJE,
    base_de_ejemplo,
    catalogo_de_ejemplo,
    entrada,
    letra,
    mod,
    objeto_alternativo,
    objeto_equipado,
    parametros_de_potencial,
)


def _con_base(catalogo: Catalogo, stat: Stat, *puntos: PuntoMedido) -> Catalogo:
    base = {**base_de_ejemplo(), stat: tuple(puntos)}
    especie = replace(catalogo.especies[0], base=base)
    return replace(catalogo, especies=(especie, *catalogo.especies[1:]))


def _con_plano_de_estrella(plano: int) -> Catalogo:
    etapa = EtapaDeEstrella(etapa=1, modificadores={Stat.ATQ: (mod(PLANO, plano),)})
    return catalogo_de_ejemplo(estrellas=(etapa,))


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
        catalogo_de_ejemplo(), entrada(nivel=30, atq=10, etapa_estrella=1, personalidad="ENFJ")
    )

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 474
    assert [(t.origen, t.detalle) for t in atq.desglose] == [
        ("base", "nivel 30"),
        ("potencial", "N 10"),
        ("salto", "2 saltos"),
        ("estrella", "etapa 1"),
        ("personalidad", "E"),
    ]
    assert [t.valor for t in atq.desglose] == [
        Decimal(390),
        Decimal(8),
        Decimal(8),
        Decimal(10),
        Decimal(2),
    ]


def test_redondeo_cercano_y_arriba() -> None:
    for redondeo, esperado in ((Redondeo.CERCANO, 474), (Redondeo.ARRIBA, 475)):
        catalogo = catalogo_de_ejemplo(redondeo=redondeo)
        resultado = calcular_sugerencia(
            catalogo, entrada(nivel=30, atq=10, etapa_estrella=1, personalidad="ENFJ")
        )
        assert resultado.stats[Stat.ATQ].valor == esperado


def test_redondeo_cercano_baja_cuando_la_fraccion_es_menor_a_la_mitad() -> None:
    catalogo = catalogo_de_ejemplo(redondeo=Redondeo.CERCANO)
    catalogo = replace(catalogo, potencial=parametros_de_potencial(por_punto=Decimal("0.3")))

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
        catalogo, entrada(nivel=30, atq=10, etapa_estrella=1, personalidad="ENFJ")
    )

    assert "personalidad" in resultado.sin_datos
    assert resultado.stats[Stat.ATQ].valor == 465  # (390 * 1,08 + 10) * 1,08 = 465,696


def test_sin_datos_lista_cada_seccion_ausente() -> None:
    catalogo = catalogo_de_ejemplo(
        potencial=None,
        etapas_de_estrella=None,
        despertar=None,
        estrellas=None,
        personalidad=None,
        objetos=None,
        cp=None,
    )

    resultado = calcular_sugerencia(catalogo, entrada(nivel=60))

    assert resultado.sin_datos == (
        "potencial",
        "etapas_de_estrella",
        "despertar",
        "estrellas",
        "personalidad",
        "objetos",
        "cp",
    )
    assert calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=60)).sin_datos == ()


def test_resultado_negativo_es_invalido() -> None:
    catalogo = _con_plano_de_estrella(-9999)

    atq = calcular_sugerencia(catalogo, entrada(nivel=1, etapa_estrella=1)).stats[Stat.ATQ]

    assert atq.valor is None
    assert atq.motivo == "resultado-invalido"


def test_resultado_cero_es_valido() -> None:
    catalogo = _con_plano_de_estrella(-100)

    atq = calcular_sugerencia(catalogo, entrada(nivel=1, etapa_estrella=1)).stats[Stat.ATQ]

    assert atq.valor == 0


def test_varias_estrellas_acumulan_solo_hasta_la_actual() -> None:
    catalogo = catalogo_de_ejemplo(potencial=None)

    assert calcular_sugerencia(catalogo, entrada(etapa_estrella=0)).stats[Stat.ATQ].valor == 690
    assert calcular_sugerencia(catalogo, entrada(etapa_estrella=1)).stats[Stat.ATQ].valor == 700
    assert calcular_sugerencia(catalogo, entrada(etapa_estrella=2)).stats[Stat.ATQ].valor == 720
    assert calcular_sugerencia(catalogo, entrada(etapa_estrella=5)).stats[Stat.ATQ].valor == 720


def test_dos_letras_que_tocan_el_mismo_stat_se_suman() -> None:
    catalogo = catalogo_de_ejemplo(
        personalidad={
            "E": letra("Energetic", {Stat.ATQ: (mod(PORCENTAJE, 5),)}),
            "N": letra("Nimble", {Stat.ATQ: (mod(PORCENTAJE, 3),)}),
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
                etapa=1, modificadores={Stat.ATQ: (mod(PORCENTAJE, 10), mod(PLANO, 7))}
            ),
        )
    )

    atq = calcular_sugerencia(catalogo, entrada(nivel=60, etapa_estrella=1)).stats[Stat.ATQ]

    assert atq.valor == 766  # (690 + 7) * 1,10 = 766,7


def test_etapa_cero_no_agrega_terminos() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(etapa_estrella=0))

    assert all(t.origen != "estrella" for t in resultado.stats[Stat.ATQ].desglose)


def test_sin_objetos_valor_con_objetos_es_igual_a_valor() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=30, atq=10))

    for sugerido in resultado.stats.values():
        assert sugerido.valor_con_objetos == sugerido.valor


CASO_R3 = {"nivel": 30, "atq": 10, "etapa_estrella": 1, "personalidad": "ENFJ"}


def test_r7_objeto_equipado_suma_sobre_el_valor_intermedio_sin_redondear() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto_equipado(),))
    )

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 474
    assert atq.valor_con_objetos == 522
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

    assert resultado.stats[Stat.ATQ].valor_con_objetos == 474
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

    assert resultado.stats[Stat.ATQ].valor == 474
    assert resultado.stats[Stat.ATQ].valor_con_objetos == 474
    assert [(o.aplicado, o.nota) for o in resultado.objetos] == [(False, nota)]


def test_equipado_y_alternativo_juntos_solo_suma_el_equipado() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(),
        entrada(**CASO_R3, objetos=(objeto_equipado(), objeto_alternativo("ejemplo-objeto-y"))),
    )

    assert resultado.stats[Stat.ATQ].valor_con_objetos == 522
    assert resultado.stats[Stat.PS].valor_con_objetos == resultado.stats[Stat.PS].valor
    assert [o.aplicado for o in resultado.objetos] == [True, False]


def test_catalogo_sin_objetos_lo_informa() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(objetos=None), entrada(**CASO_R3, objetos=(objeto_equipado(),))
    )

    assert "objetos" in resultado.sin_datos
    assert resultado.stats[Stat.ATQ].valor_con_objetos == resultado.stats[Stat.ATQ].valor == 474
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

    assert resultado.cp.valor == 594
    assert resultado.cp.valor_con_objetos == 642
    assert resultado.cp.motivo is None


def test_r10_sin_formula_de_cp() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(cp=None), entrada(**CASO_R3))

    assert resultado.cp.valor is None
    assert resultado.cp.valor_con_objetos is None
    assert resultado.cp.motivo == "sin-datos"
    assert "cp" in resultado.sin_datos
    assert resultado.stats[Stat.ATQ].valor == 474


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

    assert resultado.cp.valor == int(Decimal("0.5") * 706 + Decimal("0.1") * 6900)
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


def test_r12_bono_de_estrella_entra_en_el_potencial_efectivo() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(nivel=60, atq=18, etapa_estrella=5)
    )

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 956  # (690 * 1,152 + 30) * 1,16 = 956,86
    assert [t.detalle for t in atq.desglose if t.origen in ("potencial", "salto")] == [
        "N 19",
        "4 saltos",
    ]


def test_r12_triangulado_sin_que_la_estrella_cuente() -> None:
    catalogo = catalogo_de_ejemplo(potencial=parametros_de_potencial(cuenta_estrella=False))

    atq = calcular_sugerencia(catalogo, entrada(nivel=60, atq=18, etapa_estrella=5)).stats[Stat.ATQ]

    assert atq.valor == 950  # (690 * 1,144 + 30) * 1,16 = 950,0...


def test_el_bono_de_estrella_solo_suma_las_etapas_alcanzadas() -> None:
    catalogo = catalogo_de_ejemplo()

    def n_de(etapa: int) -> str:
        atq = calcular_sugerencia(catalogo, entrada(nivel=60, atq=10, etapa_estrella=etapa))
        return next(t.detalle for t in atq.stats[Stat.ATQ].desglose if t.origen == "potencial")

    assert [n_de(etapa) for etapa in (4, 5, 6, 7)] == ["N 10", "N 11", "N 12", "N 14"]


def test_sin_etapas_de_estrella_el_bono_es_cero() -> None:
    catalogo = catalogo_de_ejemplo(etapas_de_estrella=None)

    atq = calcular_sugerencia(catalogo, entrada(nivel=60, atq=10, etapa_estrella=7)).stats[Stat.ATQ]

    assert next(t.detalle for t in atq.desglose if t.origen == "potencial") == "N 10"


def test_sin_seccion_potencial_no_hay_factor_ni_saltos() -> None:
    catalogo = catalogo_de_ejemplo(potencial=None)

    resultado = calcular_sugerencia(catalogo, entrada(nivel=60, atq=20, etapa_estrella=5))

    assert resultado.stats[Stat.ATQ].valor == 720
    assert "potencial" in resultado.sin_datos
    assert {t.origen for t in resultado.stats[Stat.ATQ].desglose} == {"base", "estrella"}


def test_potencial_cero_no_agrega_terminos_de_potencial() -> None:
    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(nivel=60, atq=3))

    assert [t.origen for t in resultado.stats[Stat.ATQ].desglose] == ["base", "potencial"]


def test_r11_objeto_con_bono_de_potencial_recalcula_con_n_mayor() -> None:
    objeto = objeto_equipado(nivel=2)

    resultado = calcular_sugerencia(catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto,)))

    atq = resultado.stats[Stat.ATQ]
    assert atq.valor == 474
    assert (
        atq.valor_con_objetos == 559
    )  # N 12: (427,44 + 10) * (1 + (12 + 2 + 12) / 100) + 8 = 559,17
    bono = next(t for t in atq.desglose if t.tipo == TipoDeTermino.PUNTOS)
    assert bono.detalle == "EJEMPLO Objeto X nivel 2: +2 potencial"
    assert bono.valor == Decimal(2)


def test_r11_con_cuenta_objeto_en_false_el_bono_no_suma() -> None:
    catalogo = catalogo_de_ejemplo(potencial=parametros_de_potencial(cuenta_objeto=False))

    atq = calcular_sugerencia(
        catalogo, entrada(**CASO_R3, objetos=(objeto_equipado(nivel=2),))
    ).stats[Stat.ATQ]

    assert atq.valor_con_objetos == 534  # N 10: 431,2 * 1,22 + 8 = 534,06
    assert all(t.tipo != TipoDeTermino.PUNTOS for t in atq.desglose)


def test_el_bono_de_potencial_del_objeto_solo_cuenta_desde_su_nivel() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto_equipado(nivel=1),))
    )

    assert all(t.tipo != TipoDeTermino.PUNTOS for t in resultado.stats[Stat.ATQ].desglose)
    assert resultado.stats[Stat.ATQ].valor_con_objetos == 522


def test_el_bono_de_potencial_solo_toca_los_stats_indicados() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto_equipado(nivel=2),))
    )

    ps = resultado.stats[Stat.PS]
    assert ps.valor_con_objetos == ps.valor


def test_objeto_alternativo_con_bono_de_potencial_no_suma() -> None:
    resultado = calcular_sugerencia(
        catalogo_de_ejemplo(), entrada(**CASO_R3, objetos=(objeto_alternativo(nivel=2),))
    )

    assert resultado.stats[Stat.ATQ].valor_con_objetos == 474


def test_objeto_con_bono_de_potencial_y_sin_modificadores_para_ese_stat() -> None:
    objeto = ObjetoDelCatalogo(
        id="ejemplo-objeto-z",
        nombre="EJEMPLO Objeto Z",
        niveles=(NivelDeObjeto(1, {Stat.PS: (mod(PLANO, 1),)}),),
        bono_potencial=BonoDePotencialDeObjeto(1, {Stat.ATQ: 4}),
    )
    catalogo = catalogo_de_ejemplo(objetos=(objeto,))

    atq = calcular_sugerencia(
        catalogo, entrada(nivel=60, objetos=(objeto_equipado("ejemplo-objeto-z"),))
    ).stats[Stat.ATQ]

    assert atq.valor == 690
    assert atq.valor_con_objetos == 740  # N 4: 690 * 1,032 * 1,04 = 740,6


def test_multiplicador_sin_potencial_es_exactamente_uno() -> None:
    assert multiplicador_de_potencial(0, parametros_de_potencial()) == 1


def test_multiplicador_de_un_punto_y_de_un_salto() -> None:
    parametros = parametros_de_potencial()

    assert multiplicador_de_potencial(1, parametros) == Decimal("1.008")
    assert multiplicador_de_potencial(4, parametros) == Decimal("1.032") * Decimal("1.04")


MEDICIONES_DE_SPARKELF = {
    8: 443,
    9: 446,
    10: 450,
    11: 453,
    12: 473,
    13: 476,
    14: 480,
    15: 483,
    16: 503,
}


def test_tabla_de_sparkelf_se_reproduce_con_una_sola_constante_ajustada() -> None:
    parametros = parametros_de_potencial()
    constante = Decimal(MEDICIONES_DE_SPARKELF[8]) / multiplicador_de_potencial(8, parametros)

    for n, medido in MEDICIONES_DE_SPARKELF.items():
        calculado = constante * multiplicador_de_potencial(n, parametros)
        assert abs(calculado - medido) / medido <= Decimal("0.003"), n


def _ps_medido(n: int, porcentajes_extra: int, constante: Decimal) -> Decimal:
    parametros = parametros_de_potencial()
    por_puntos = 1 + parametros.por_punto * n / 100
    saltos = n // parametros.salto_cada
    porcentajes = parametros.salto_porcentaje * saltos + porcentajes_extra
    return constante * por_puntos * (1 + porcentajes / 100)


def _constante_del_infergon() -> Decimal:
    # Infergon nivel 1, INFJ (J: PS +4%), potencial PS 4, sin objeto: PS 990 medido.
    return Decimal(990) / _ps_medido(4, 4, Decimal(1))


def test_infergon_sin_objeto_reproduce_el_ps_medido() -> None:
    assert int(_ps_medido(4, 4, _constante_del_infergon())) == 990


def test_petaca_suma_su_porcentaje_a_los_demas_y_no_los_multiplica() -> None:
    constante = _constante_del_infergon()

    aditivo = _ps_medido(4, 4 + 10, constante)

    assert int(aditivo) == 1081  # 990 * 1,18 / 1,08 = 1081,67; truncado como el juego
    assert int(Decimal(990) * Decimal("1.10")) == 1089  # el modelo multiplicativo no coincide


def test_aguja_encaja_solo_si_el_mas_2_es_potencial() -> None:
    constante = _constante_del_infergon()

    como_potencial = _ps_medido(6, 4 + 20, constante)
    como_plano = _ps_medido(4, 4 + 20, constante) + 2

    assert int(como_potencial) == 1191  # 1173 * 1,048 / 1,032 = 1191,5
    assert int(como_plano) == 1175


def _catalogo_del_infergon() -> Catalogo:
    # Base de PS escalada x1000 para no perder precision con enteros: 990 / (1,032 * 1,08).
    ps = (PuntoMedido(1, 888_259), PuntoMedido(60, 888_259))
    catalogo = _con_base(catalogo_de_ejemplo(), Stat.PS, *ps)
    petaca = ObjetoDelCatalogo(
        id="petaca",
        nombre="EJEMPLO Petaca",
        niveles=(NivelDeObjeto(1, {Stat.PS: (mod(PORCENTAJE, 10),)}),),
    )
    aguja = ObjetoDelCatalogo(
        id="aguja",
        nombre="EJEMPLO Aguja",
        niveles=(NivelDeObjeto(15, {Stat.PS: (mod(PORCENTAJE, 20),)}),),
        bono_potencial=BonoDePotencialDeObjeto(1, {Stat.PS: 2}),
    )
    return replace(catalogo, objetos=(petaca, aguja))


def _ps_del_infergon(objeto: str | None = None, nivel: int = 1) -> tuple[int | None, int | None]:
    objetos = () if objeto is None else (objeto_equipado(objeto, nivel),)
    resultado = calcular_sugerencia(
        _catalogo_del_infergon(), entrada(nivel=1, ps=4, personalidad="INFJ", objetos=objetos)
    )
    ps = resultado.stats[Stat.PS]
    return ps.valor, ps.valor_con_objetos


def test_infergon_ps_sin_objeto_en_el_motor() -> None:
    valor, con_objetos = _ps_del_infergon()

    assert (valor // 1000, con_objetos // 1000) == (990, 990)  # type: ignore[operator]


def test_petaca_en_el_motor_suma_su_porcentaje_a_los_demas() -> None:
    valor, con_objetos = _ps_del_infergon("petaca")

    assert valor // 1000 == 990  # type: ignore[operator]
    assert con_objetos // 1000 == 1081  # type: ignore[operator]  # 990 * 1,18 / 1,08; multiplicativo daria 1089


def test_aguja_en_el_motor_suma_el_porcentaje_y_el_potencial() -> None:
    _, con_objetos = _ps_del_infergon("aguja", 15)

    assert con_objetos // 1000 == 1191  # type: ignore[operator]  # N 6, +20% sumado
