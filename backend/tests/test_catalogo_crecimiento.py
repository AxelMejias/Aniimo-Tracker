import copy
import json
from collections.abc import Callable
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    Catalogo,
    Confianza,
    Interpolacion,
    ObjetoDeLaEntrada,
    Redondeo,
    TipoDeModificador,
    calcular_sugerencia,
)
from app.infrastructure.catalogo_crecimiento import (
    RUTA_POR_DEFECTO,
    ErrorDeCatalogo,
    leer_catalogo,
)
from tests.catalogo_de_ejemplo import entrada, objeto_equipado

Datos = dict[str, Any]

STATS = ("ps", "atq", "def_fisica", "def_magica", "regen", "quiebre")


def _base() -> Datos:
    return {
        stat: [{"nivel": 1, "valor": 100}, {"nivel": 30, "valor": 200}, {"nivel": 60, "valor": 300}]
        for stat in STATS
    }


def datos_validos() -> Datos:
    return {
        "formato": 2,
        "version": "ejemplo-test",
        "es_ejemplo": True,
        "estimacion_verificada": False,
        "fecha_parche": "2026-09-23",
        "cambios_conocidos": [
            {"fecha": "2026-08-01", "descripcion": "Cambio uno", "confianza": "fan"},
            {"fecha": "2026-09-23", "descripcion": "Cambio dos", "confianza": "medido"},
        ],
        "redondeo": "abajo",
        "interpolacion": "lineal",
        "especies": [
            {"id": "ejemplo-a", "nombre": "EJEMPLO A", "base": _base()},
            {"id": "ejemplo-b", "nombre": "EJEMPLO B", "base": _base()},
        ],
        "potencial": {
            "confianza": "medido",
            "por_punto": 0.8,
            "salto": {"cada": 4, "porcentaje": 4},
            "cuenta_estrella": True,
            "cuenta_objeto": True,
        },
        "etapas_de_estrella": {
            "confianza": "medido",
            "etapas": [
                {"etapa": 5, "bono_potencial": 1, "bono_cupo": 5},
                {"etapa": 6, "bono_potencial": 1, "bono_cupo": 8},
                {"etapa": 7, "bono_potencial": 2, "bono_cupo": 10},
            ],
        },
        "despertar": {
            "confianza": "medido",
            "aumentos_por_nivel": [
                {"nivel": 1, "suma": 5},
                {"nivel": 45, "suma": 5},
                {"nivel": 60, "suma": 10},
            ],
        },
        "estrellas": [
            {"etapa": 1, "modificadores": {"atq": [{"tipo": "plano", "valor": 10}]}},
            {"etapa": 2, "modificadores": {"atq": [{"tipo": "plano", "valor": 20}]}},
        ],
        "personalidad": {
            "E": {
                "nombre": "Energetic",
                "letra_confirmada": True,
                "confianza": "medido",
                "modificadores": {"atq": [{"tipo": "porcentaje", "valor": 2}]},
                "otros": [],
            },
            "N": {
                "nombre": "Nimble",
                "letra_confirmada": False,
                "confianza": "inferido",
                "modificadores": {},
                "otros": [{"descripcion": "Prob. de crítico", "porcentaje": 5}],
            },
        },
        "objetos": [
            {
                "id": "ejemplo-objeto-x",
                "nombre": "EJEMPLO Objeto X",
                "bono_potencial": {"desde_nivel": 2, "stats": {"atq": 2}},
                "niveles": [
                    {
                        "nivel": 1,
                        "modificadores": {
                            "atq": [
                                {"tipo": "porcentaje", "valor": 10},
                                {"tipo": "plano", "valor": 5},
                            ]
                        },
                    },
                    {"nivel": 2, "modificadores": {"atq": [{"tipo": "plano", "valor": 6.5}]}},
                ],
            },
            {
                "id": "ejemplo-objeto-y",
                "nombre": "EJEMPLO Objeto Y",
                "niveles": [
                    {"nivel": 1, "modificadores": {"ps": [{"tipo": "plano", "valor": 50}]}}
                ],
            },
        ],
        "cp": {"constante": 100, "pesos": {"atq": 1, "ps": 0.5}, "por_punto_de_potencial": 2},
    }


def escribir(carpeta: Path, datos: object, nombre: str = "catalogo.json") -> Path:
    ruta = carpeta / nombre
    ruta.write_text(json.dumps(datos), encoding="utf-8")
    return ruta


def errores_de(carpeta: Path, datos: object) -> tuple[str, ...]:
    resultado = leer_catalogo(escribir(carpeta, datos))
    assert isinstance(resultado, ErrorDeCatalogo), "se esperaba un error de catálogo"
    return resultado.errores


def catalogo_de(carpeta: Path, datos: object) -> Catalogo:
    resultado = leer_catalogo(escribir(carpeta, datos))
    assert isinstance(resultado, Catalogo), getattr(resultado, "errores", None)
    return resultado


def test_un_catalogo_valido_se_traduce_a_las_entidades_del_dominio(tmp_path: Path) -> None:
    catalogo = catalogo_de(tmp_path, datos_validos())

    assert catalogo.version == "ejemplo-test"
    assert catalogo.es_ejemplo is True
    assert catalogo.redondeo is Redondeo.ABAJO
    assert catalogo.interpolacion is Interpolacion.LINEAL
    assert [e.id for e in catalogo.especies] == ["ejemplo-a", "ejemplo-b"]
    assert [p.nivel for p in catalogo.especies[0].base[Stat.ATQ]] == [1, 30, 60]
    assert catalogo.formato == 2
    assert catalogo.estimacion_verificada is False
    assert catalogo.fecha_parche == date(2026, 9, 23)
    assert [c.fecha for c in catalogo.cambios_conocidos] == [date(2026, 8, 1), date(2026, 9, 23)]
    assert catalogo.cambios_conocidos[0].confianza is Confianza.FAN
    assert catalogo.potencial is not None
    assert catalogo.potencial.por_punto == Decimal("0.8")
    assert isinstance(catalogo.potencial.por_punto, Decimal)
    assert (catalogo.potencial.salto_cada, catalogo.potencial.salto_porcentaje) == (4, Decimal(4))
    assert catalogo.potencial.cuenta_estrella is True
    assert catalogo.potencial.confianza is Confianza.MEDIDO
    assert catalogo.etapas_de_estrella is not None
    assert [
        (e.etapa, e.bono_potencial, e.bono_cupo) for e in catalogo.etapas_de_estrella.etapas
    ] == [
        (5, 1, 5),
        (6, 1, 8),
        (7, 2, 10),
    ]
    assert catalogo.despertar is not None
    assert [(a.nivel, a.suma) for a in catalogo.despertar.aumentos_por_nivel] == [
        (1, 5),
        (45, 5),
        (60, 10),
    ]
    assert catalogo.estrellas is not None
    assert [e.etapa for e in catalogo.estrellas] == [1, 2]
    assert catalogo.personalidad is not None
    energetic = catalogo.personalidad["E"]
    assert energetic.nombre == "Energetic"
    assert energetic.letra_confirmada is True
    assert energetic.modificadores[Stat.ATQ][0].tipo is TipoDeModificador.PORCENTAJE
    nimble = catalogo.personalidad["N"]
    assert nimble.modificadores == {}
    assert nimble.otros[0].descripcion == "Prob. de crítico"
    assert nimble.otros[0].porcentaje == Decimal(5)
    assert catalogo.cp is not None
    assert catalogo.cp.pesos[Stat.PS] == Decimal("0.5")
    assert isinstance(catalogo.cp.pesos[Stat.PS], Decimal)
    assert catalogo.cp.por_punto_de_potencial == Decimal(2)
    assert catalogo.objetos is not None
    assert catalogo.objetos[0].niveles[1].modificadores[Stat.ATQ][0].valor == Decimal("6.5")
    bono = catalogo.objetos[0].bono_potencial
    assert bono is not None
    assert (bono.desde_nivel, dict(bono.stats)) == (2, {Stat.ATQ: 2})
    assert catalogo.objetos[1].bono_potencial is None


def test_las_secciones_opcionales_pueden_faltar(tmp_path: Path) -> None:
    datos = datos_validos()
    for seccion in (
        "cambios_conocidos",
        "potencial",
        "etapas_de_estrella",
        "despertar",
        "estrellas",
        "personalidad",
        "objetos",
        "cp",
    ):
        del datos[seccion]

    catalogo = catalogo_de(tmp_path, datos)

    assert catalogo.cambios_conocidos == ()
    assert catalogo.potencial is None
    assert catalogo.etapas_de_estrella is None
    assert catalogo.despertar is None
    assert catalogo.estrellas is None
    assert catalogo.personalidad is None
    assert catalogo.objetos is None
    assert catalogo.cp is None


def test_cp_con_constante_por_defecto_cero_y_sin_puntos_de_potencial(tmp_path: Path) -> None:
    datos = datos_validos()
    datos["cp"] = {"pesos": {"atq": 1}}

    catalogo = catalogo_de(tmp_path, datos)

    assert catalogo.cp is not None
    assert catalogo.cp.constante == Decimal(0)
    assert catalogo.cp.por_punto_de_potencial is None


def test_los_decimales_se_leen_exactos_no_como_float(tmp_path: Path) -> None:
    datos = datos_validos()
    datos["cp"]["pesos"]["atq"] = 0.1

    catalogo = catalogo_de(tmp_path, datos)

    assert catalogo.cp is not None
    assert catalogo.cp.pesos[Stat.ATQ] == Decimal("0.1")


Mutacion = Callable[[Datos], None]


def _en_raiz(d: Datos) -> None:
    d["formula"] = "x*2"


def _en_especie(d: Datos) -> None:
    d["especies"][0]["formula"] = "x*2"


def _en_objeto(d: Datos) -> None:
    d["objetos"][1]["formula"] = "x*2"


def _en_cp(d: Datos) -> None:
    d["cp"]["formula"] = "x*2"


def _niveles_desordenados(d: Datos) -> None:
    d["especies"][0]["base"]["atq"] = [
        {"nivel": 1, "valor": 1},
        {"nivel": 60, "valor": 2},
        {"nivel": 30, "valor": 3},
    ]


def _niveles_repetidos(d: Datos) -> None:
    d["especies"][1]["base"]["def_fisica"][2]["nivel"] = 30


def _nivel_de_objeto_repetido(d: Datos) -> None:
    d["objetos"][0]["niveles"][1]["nivel"] = 1


def _nivel_de_objeto_cero(d: Datos) -> None:
    d["objetos"][0]["niveles"][0]["nivel"] = 0


def _nivel_de_objeto_cien(d: Datos) -> None:
    d["objetos"][0]["niveles"][1]["nivel"] = 100


def _falta_un_stat(d: Datos) -> None:
    del d["especies"][0]["base"]["quiebre"]


def _stat_desconocido_en_pesos(d: Datos) -> None:
    d["cp"]["pesos"]["velocidad"] = 1


def _stat_desconocido_en_objeto(d: Datos) -> None:
    d["objetos"][0]["niveles"][0]["modificadores"]["velocidad"] = [{"tipo": "plano", "valor": 1}]


def _modificadores_del_mismo_tipo(d: Datos) -> None:
    d["objetos"][0]["niveles"][0]["modificadores"]["atq"] = [
        {"tipo": "porcentaje", "valor": 1},
        {"tipo": "porcentaje", "valor": 2},
    ]


def _tres_modificadores(d: Datos) -> None:
    d["estrellas"][0]["modificadores"]["atq"] = [{"tipo": "plano", "valor": 1}] * 3


def _lista_vacia_de_modificadores(d: Datos) -> None:
    d["estrellas"][0]["modificadores"]["atq"] = []


def _valor_como_string(d: Datos) -> None:
    d["especies"][0]["base"]["atq"][0]["valor"] = "100"


def _valor_decimal_donde_va_entero(d: Datos) -> None:
    d["especies"][0]["base"]["atq"][0]["valor"] = 100.5


def _peso_como_string(d: Datos) -> None:
    d["cp"]["pesos"]["atq"] = "1"


def _modificador_como_string(d: Datos) -> None:
    d["potencial"]["por_punto"] = "5"


def _modificador_booleano(d: Datos) -> None:
    d["potencial"]["por_punto"] = True


def _sin_es_ejemplo(d: Datos) -> None:
    del d["es_ejemplo"]


def _es_ejemplo_como_string(d: Datos) -> None:
    d["es_ejemplo"] = "true"


def _especie_repetida(d: Datos) -> None:
    d["especies"][1]["id"] = "ejemplo-a"


def _objeto_repetido(d: Datos) -> None:
    d["objetos"][1]["id"] = "ejemplo-objeto-x"


def _id_con_mayusculas(d: Datos) -> None:
    d["especies"][0]["id"] = "Ejemplo-A"


def _id_con_ruta(d: Datos) -> None:
    d["objetos"][0]["id"] = "../x"


def _multiplicar(d: Datos) -> None:
    d["estrellas"][0]["modificadores"]["atq"][0]["tipo"] = "multiplicar"


def _letra_x(d: Datos) -> None:
    d["personalidad"]["X"] = d["personalidad"]["E"]


def _estrella_repetida(d: Datos) -> None:
    d["estrellas"][1]["etapa"] = 1


def _modificador_fuera_de_rango(d: Datos) -> None:
    d["potencial"]["por_punto"] = 100.5


def _sin_especies(d: Datos) -> None:
    d["especies"] = []


def _redondeo_invalido(d: Datos) -> None:
    d["redondeo"] = "techo"


def _interpolacion_invalida(d: Datos) -> None:
    d["interpolacion"] = "cubica"


def _nivel_de_especie_cero(d: Datos) -> None:
    d["especies"][0]["base"]["ps"][0]["nivel"] = 0


def _nombre_vacio(d: Datos) -> None:
    d["especies"][0]["nombre"] = ""


def _en_potencial(d: Datos) -> None:
    d["potencial"]["formula"] = "x*2"


def _en_salto(d: Datos) -> None:
    d["potencial"]["salto"]["formula"] = "x*2"


def _en_etapas(d: Datos) -> None:
    d["etapas_de_estrella"]["etapas"][0]["formula"] = "x*2"


def _en_despertar(d: Datos) -> None:
    d["despertar"]["formula"] = "x*2"


def _en_letra(d: Datos) -> None:
    d["personalidad"]["E"]["formula"] = "x*2"


def _en_bono_de_objeto(d: Datos) -> None:
    d["objetos"][0]["bono_potencial"]["formula"] = "x*2"


def _en_cambio(d: Datos) -> None:
    d["cambios_conocidos"][0]["formula"] = "x*2"


def _sin_formato(d: Datos) -> None:
    del d["formato"]


def _formato_uno(d: Datos) -> None:
    d["formato"] = 1


def _potencial_con_forma_de_c08(d: Datos) -> None:
    d["potencial"] = {"atq": {"tipo": "porcentaje", "valor": 1}}


def _sin_estimacion_verificada(d: Datos) -> None:
    del d["estimacion_verificada"]


def _estimacion_como_string(d: Datos) -> None:
    d["estimacion_verificada"] = "false"


def _sin_fecha_de_parche(d: Datos) -> None:
    del d["fecha_parche"]


def _fecha_inexistente(d: Datos) -> None:
    d["fecha_parche"] = "2026-02-30"


def _fecha_con_otro_formato(d: Datos) -> None:
    d["fecha_parche"] = "29/10/2026"


def _fecha_fuera_de_rango(d: Datos) -> None:
    d["fecha_parche"] = "2019-12-31"


def _fecha_de_cambio_repetida(d: Datos) -> None:
    d["cambios_conocidos"][1]["fecha"] = "2026-08-01"


def _fechas_de_cambio_desordenadas(d: Datos) -> None:
    d["cambios_conocidos"][0]["fecha"] = "2026-10-01"


def _confianza_invalida(d: Datos) -> None:
    d["potencial"]["confianza"] = "seguro"


def _sin_confianza_en_cambio(d: Datos) -> None:
    del d["cambios_conocidos"][0]["confianza"]


def _descripcion_de_cambio_vacia(d: Datos) -> None:
    d["cambios_conocidos"][0]["descripcion"] = ""


def _cada_cero(d: Datos) -> None:
    d["potencial"]["salto"]["cada"] = 0


def _cada_veintiuno(d: Datos) -> None:
    d["potencial"]["salto"]["cada"] = 21


def _porcentaje_de_salto_negativo(d: Datos) -> None:
    d["potencial"]["salto"]["porcentaje"] = -1


def _por_punto_negativo(d: Datos) -> None:
    d["potencial"]["por_punto"] = -0.1


def _cuenta_estrella_como_string(d: Datos) -> None:
    d["potencial"]["cuenta_estrella"] = "si"


def _sin_cuenta_objeto(d: Datos) -> None:
    del d["potencial"]["cuenta_objeto"]


def _etapa_repetida(d: Datos) -> None:
    d["etapas_de_estrella"]["etapas"][1]["etapa"] = 5


def _etapa_ocho(d: Datos) -> None:
    d["etapas_de_estrella"]["etapas"][2]["etapa"] = 8


def _etapa_desordenada(d: Datos) -> None:
    d["etapas_de_estrella"]["etapas"][0]["etapa"] = 6


def _bono_de_cupo_decimal(d: Datos) -> None:
    d["etapas_de_estrella"]["etapas"][0]["bono_cupo"] = 5.5


def _bono_de_potencial_alto(d: Datos) -> None:
    d["etapas_de_estrella"]["etapas"][0]["bono_potencial"] = 21


def _sin_etapas(d: Datos) -> None:
    d["etapas_de_estrella"]["etapas"] = []


def _estrella_con_etapa_cero(d: Datos) -> None:
    d["estrellas"][0]["etapa"] = 0


def _estrella_con_clave_vieja(d: Datos) -> None:
    d["estrellas"][0]["estrella"] = d["estrellas"][0].pop("etapa")


def _despertar_desde_el_nivel_dos(d: Datos) -> None:
    d["despertar"]["aumentos_por_nivel"][0]["nivel"] = 2


def _despertar_desordenado(d: Datos) -> None:
    d["despertar"]["aumentos_por_nivel"][2]["nivel"] = 45


def _suma_de_despertar_alta(d: Datos) -> None:
    d["despertar"]["aumentos_por_nivel"][1]["suma"] = 1000


def _despertar_vacio(d: Datos) -> None:
    d["despertar"]["aumentos_por_nivel"] = []


def _letra_sin_nombre(d: Datos) -> None:
    d["personalidad"]["E"]["nombre"] = ""


def _letra_sin_confirmacion(d: Datos) -> None:
    del d["personalidad"]["E"]["letra_confirmada"]


def _letra_con_confirmacion_como_string(d: Datos) -> None:
    d["personalidad"]["E"]["letra_confirmada"] = "si"


def _letra_sin_modificadores(d: Datos) -> None:
    del d["personalidad"]["E"]["modificadores"]


def _stat_desconocido_en_letra(d: Datos) -> None:
    d["personalidad"]["E"]["modificadores"]["velocidad"] = [{"tipo": "plano", "valor": 1}]


def _cuatro_otros_efectos(d: Datos) -> None:
    d["personalidad"]["N"]["otros"] = [{"descripcion": "x", "porcentaje": 1}] * 4


def _otro_efecto_sin_descripcion(d: Datos) -> None:
    d["personalidad"]["N"]["otros"][0]["descripcion"] = ""


def _stat_desconocido_en_bono(d: Datos) -> None:
    d["objetos"][0]["bono_potencial"]["stats"]["velocidad"] = 1


def _bono_de_objeto_alto(d: Datos) -> None:
    d["objetos"][0]["bono_potencial"]["stats"]["atq"] = 11


def _bono_de_objeto_cero(d: Datos) -> None:
    d["objetos"][0]["bono_potencial"]["stats"]["atq"] = 0


def _bono_de_objeto_decimal(d: Datos) -> None:
    d["objetos"][0]["bono_potencial"]["stats"]["atq"] = 1.5


def _bono_de_objeto_sin_stats(d: Datos) -> None:
    d["objetos"][0]["bono_potencial"]["stats"] = {}


def _desde_nivel_cero(d: Datos) -> None:
    d["objetos"][0]["bono_potencial"]["desde_nivel"] = 0


CASOS_INVALIDOS: list[tuple[Mutacion, str, str]] = [
    (_en_potencial, "potencial.formula", "no permitido"),
    (_en_salto, "potencial.salto.formula", "no permitido"),
    (_en_etapas, "etapas_de_estrella.etapas[0].formula", "no permitido"),
    (_en_despertar, "despertar.formula", "no permitido"),
    (_en_letra, "personalidad.E.formula", "no permitido"),
    (_en_bono_de_objeto, "objetos[0].bono_potencial.formula", "no permitido"),
    (_en_cambio, "cambios_conocidos[0].formula", "no permitido"),
    (_sin_formato, "formato", "formato anterior"),
    (_formato_uno, "formato", "formato 2"),
    (_potencial_con_forma_de_c08, "potencial.atq", "no permitido"),
    (_sin_estimacion_verificada, "estimacion_verificada", "falta"),
    (_estimacion_como_string, "estimacion_verificada", "verdadero o falso"),
    (_sin_fecha_de_parche, "fecha_parche", "falta"),
    (_fecha_inexistente, "fecha_parche", "fecha"),
    (_fecha_con_otro_formato, "fecha_parche", "AAAA-MM-DD"),
    (_fecha_fuera_de_rango, "fecha_parche", "entre"),
    (_fecha_de_cambio_repetida, "cambios_conocidos[1].fecha", "posterior"),
    (_fechas_de_cambio_desordenadas, "cambios_conocidos[1].fecha", "posterior"),
    (_confianza_invalida, "potencial.confianza", "oficial"),
    (_sin_confianza_en_cambio, "cambios_conocidos[0].confianza", "falta"),
    (_descripcion_de_cambio_vacia, "cambios_conocidos[0].descripcion", "al menos 1"),
    (_cada_cero, "potencial.salto.cada", "mayor o igual a 1"),
    (_cada_veintiuno, "potencial.salto.cada", "menor o igual a 20"),
    (_porcentaje_de_salto_negativo, "potencial.salto.porcentaje", "mayor o igual a 0"),
    (_por_punto_negativo, "potencial.por_punto", "mayor o igual a 0"),
    (_cuenta_estrella_como_string, "potencial.cuenta_estrella", "verdadero o falso"),
    (_sin_cuenta_objeto, "potencial.cuenta_objeto", "falta"),
    (_etapa_repetida, "etapas_de_estrella.etapas[1].etapa", "mayor que"),
    (_etapa_ocho, "etapas_de_estrella.etapas[2].etapa", "menor o igual a 7"),
    (_etapa_desordenada, "etapas_de_estrella.etapas[1].etapa", "mayor que"),
    (_bono_de_cupo_decimal, "etapas_de_estrella.etapas[0].bono_cupo", "entero"),
    (_bono_de_potencial_alto, "etapas_de_estrella.etapas[0].bono_potencial", "menor o igual a 20"),
    (_sin_etapas, "etapas_de_estrella.etapas", "al menos 1"),
    (_estrella_con_etapa_cero, "estrellas[0].etapa", "mayor o igual a 1"),
    (_estrella_con_clave_vieja, "estrellas[0].etapa", "falta"),
    (_despertar_desde_el_nivel_dos, "despertar.aumentos_por_nivel[0].nivel", "debe ser 1"),
    (_despertar_desordenado, "despertar.aumentos_por_nivel[2].nivel", "mayor que"),
    (_suma_de_despertar_alta, "despertar.aumentos_por_nivel[1].suma", "menor o igual a 999"),
    (_despertar_vacio, "despertar.aumentos_por_nivel", "al menos 1"),
    (_letra_sin_nombre, "personalidad.E.nombre", "al menos 1"),
    (_letra_sin_confirmacion, "personalidad.E.letra_confirmada", "falta"),
    (_letra_con_confirmacion_como_string, "personalidad.E.letra_confirmada", "verdadero o falso"),
    (_letra_sin_modificadores, "personalidad.E.modificadores", "falta"),
    (_stat_desconocido_en_letra, "personalidad.E.modificadores.velocidad", "stat"),
    (_cuatro_otros_efectos, "personalidad.N.otros", "como máximo 3"),
    (_otro_efecto_sin_descripcion, "personalidad.N.otros[0].descripcion", "al menos 1"),
    (_stat_desconocido_en_bono, "objetos[0].bono_potencial.stats.velocidad", "stat"),
    (_bono_de_objeto_alto, "objetos[0].bono_potencial.stats.atq", "menor o igual a 10"),
    (_bono_de_objeto_cero, "objetos[0].bono_potencial.stats.atq", "mayor o igual a 1"),
    (_bono_de_objeto_decimal, "objetos[0].bono_potencial.stats.atq", "entero"),
    (_bono_de_objeto_sin_stats, "objetos[0].bono_potencial.stats", "al menos 1"),
    (_desde_nivel_cero, "objetos[0].bono_potencial.desde_nivel", "mayor o igual a 1"),
    (_en_raiz, "formula", "no permitido"),
    (_en_especie, "especies[0].formula", "no permitido"),
    (_en_objeto, "objetos[1].formula", "no permitido"),
    (_en_cp, "cp.formula", "no permitido"),
    (_niveles_desordenados, "especies[0].base.atq[2].nivel", "mayor que el nivel anterior"),
    (_niveles_repetidos, "especies[1].base.def_fisica[2].nivel", "mayor que el nivel anterior"),
    (_nivel_de_objeto_repetido, "objetos[0].niveles[1].nivel", "mayor que el nivel anterior"),
    (_nivel_de_objeto_cero, "objetos[0].niveles[0].nivel", "mayor o igual a 1"),
    (_nivel_de_objeto_cien, "objetos[0].niveles[1].nivel", "menor o igual a 99"),
    (_falta_un_stat, "especies[0].base.quiebre", "falta"),
    (_stat_desconocido_en_pesos, "cp.pesos.velocidad", "stat"),
    (_stat_desconocido_en_objeto, "objetos[0].niveles[0].modificadores.velocidad", "stat"),
    (_modificadores_del_mismo_tipo, "objetos[0].niveles[0].modificadores.atq", "mismo tipo"),
    (_tres_modificadores, "estrellas[0].modificadores.atq", "como máximo 2"),
    (_lista_vacia_de_modificadores, "estrellas[0].modificadores.atq", "al menos 1"),
    (_valor_como_string, "especies[0].base.atq[0].valor", "entero"),
    (_valor_decimal_donde_va_entero, "especies[0].base.atq[0].valor", "entero"),
    (_peso_como_string, "cp.pesos.atq", "número"),
    (_modificador_como_string, "potencial.por_punto", "número"),
    (_modificador_booleano, "potencial.por_punto", "número"),
    (_sin_es_ejemplo, "es_ejemplo", "falta"),
    (_es_ejemplo_como_string, "es_ejemplo", "verdadero o falso"),
    (_especie_repetida, "especies[1].id", "repetido"),
    (_objeto_repetido, "objetos[1].id", "repetido"),
    (_id_con_mayusculas, "especies[0].id", "formato"),
    (_id_con_ruta, "objetos[0].id", "formato"),
    (_multiplicar, "estrellas[0].modificadores.atq[0].tipo", "porcentaje"),
    (_letra_x, "personalidad.X", "letra de personalidad"),
    (_estrella_repetida, "estrellas[1].etapa", "repetida"),
    (_modificador_fuera_de_rango, "potencial.por_punto", "menor o igual a 100"),
    (_sin_especies, "especies", "al menos 1"),
    (_redondeo_invalido, "redondeo", "abajo"),
    (_interpolacion_invalida, "interpolacion", "lineal"),
    (_nivel_de_especie_cero, "especies[0].base.ps[0].nivel", "mayor o igual a 1"),
    (_nombre_vacio, "especies[0].nombre", "al menos 1"),
]


@pytest.mark.parametrize(
    ("mutar", "campo", "motivo"),
    CASOS_INVALIDOS,
    ids=[caso[0].__name__.lstrip("_") for caso in CASOS_INVALIDOS],
)
def test_cada_regla_invalida_informa_la_ruta_del_campo_y_el_motivo(
    tmp_path: Path, mutar: Mutacion, campo: str, motivo: str
) -> None:
    datos = copy.deepcopy(datos_validos())
    mutar(datos)

    errores = errores_de(tmp_path, datos)

    coincidencias = [e for e in errores if e.startswith(f"{campo}: ")]
    assert coincidencias, errores
    assert motivo in coincidencias[0], coincidencias


def test_varios_errores_se_informan_juntos(tmp_path: Path) -> None:
    datos = datos_validos()
    _niveles_repetidos(datos)
    _multiplicar(datos)

    errores = errores_de(tmp_path, datos)

    assert any(e.startswith("especies[1].base.def_fisica") for e in errores)
    assert any(e.startswith("estrellas[0].modificadores.atq[0].tipo") for e in errores)


def test_un_catalogo_con_cp_de_pesos_no_numericos_no_filtra_valores(tmp_path: Path) -> None:
    datos = datos_validos()
    datos["cp"]["pesos"]["atq"] = "marcador-xyz"

    errores = errores_de(tmp_path, datos)

    assert all("marcador-xyz" not in e for e in errores)


def test_archivo_de_mas_de_un_mib_se_rechaza_sin_parsear(tmp_path: Path) -> None:
    ruta = tmp_path / "grande.json"
    ruta.write_bytes(b" " * (1024 * 1024 + 1))

    resultado = leer_catalogo(ruta)

    assert isinstance(resultado, ErrorDeCatalogo)
    assert "1 MiB" in resultado.errores[0]


def test_json_roto(tmp_path: Path) -> None:
    ruta = tmp_path / "roto.json"
    ruta.write_text('{"version": ', encoding="utf-8")

    resultado = leer_catalogo(ruta)

    assert isinstance(resultado, ErrorDeCatalogo)
    assert "JSON" in resultado.errores[0]


def test_archivo_que_no_es_utf8(tmp_path: Path) -> None:
    ruta = tmp_path / "latin.json"
    ruta.write_bytes(b'{"version": "\xe9"}')

    resultado = leer_catalogo(ruta)

    assert isinstance(resultado, ErrorDeCatalogo)
    assert "UTF-8" in resultado.errores[0]


def test_archivo_inexistente(tmp_path: Path) -> None:
    resultado = leer_catalogo(tmp_path / "no-esta.json")

    assert isinstance(resultado, ErrorDeCatalogo)
    assert "no se pudo leer" in resultado.errores[0]


@pytest.mark.parametrize("contenido", ["[]", "null", "5", '"texto"'])
def test_la_raiz_debe_ser_un_objeto(tmp_path: Path, contenido: str) -> None:
    ruta = tmp_path / "raiz.json"
    ruta.write_text(contenido, encoding="utf-8")

    resultado = leer_catalogo(ruta)

    assert isinstance(resultado, ErrorDeCatalogo)
    assert resultado.errores


@pytest.mark.parametrize("constante", ["NaN", "Infinity", "-Infinity"])
def test_nan_e_infinito_no_son_numeros_validos(tmp_path: Path, constante: str) -> None:
    ruta = tmp_path / "nan.json"
    texto = json.dumps(datos_validos()).replace('"atq": 1,', f'"atq": {constante},', 1)
    ruta.write_text(texto, encoding="utf-8")

    resultado = leer_catalogo(ruta)

    assert isinstance(resultado, ErrorDeCatalogo)


def test_el_archivo_del_repo_es_valido_y_esta_marcado_como_ejemplo() -> None:
    resultado = leer_catalogo(RUTA_POR_DEFECTO)

    assert isinstance(resultado, Catalogo), getattr(resultado, "errores", None)
    assert resultado.formato == 2
    assert resultado.es_ejemplo is True
    assert resultado.estimacion_verificada is False
    assert isinstance(resultado.fecha_parche, date)
    assert resultado.objetos
    assert resultado.cp is not None
    assert all(e.nombre.startswith("EJEMPLO") for e in resultado.especies)
    assert all(o.nombre.startswith("EJEMPLO") for o in resultado.objetos)
    assert {e.id for e in resultado.especies} >= {"ejemplo-a", "ejemplo-b"}
    assert {o.id for o in resultado.objetos} >= {"ejemplo-objeto-x", "ejemplo-objeto-y"}


def test_el_archivo_del_repo_trae_las_reglas_medidas_con_su_confianza() -> None:
    catalogo = leer_catalogo(RUTA_POR_DEFECTO)
    assert isinstance(catalogo, Catalogo)

    potencial = catalogo.potencial
    assert potencial is not None
    assert (potencial.por_punto, potencial.salto_cada, potencial.salto_porcentaje) == (
        Decimal("0.8"),
        4,
        Decimal(4),
    )
    assert potencial.confianza is Confianza.MEDIDO
    assert catalogo.etapas_de_estrella is not None
    assert [
        (e.etapa, e.bono_potencial, e.bono_cupo) for e in catalogo.etapas_de_estrella.etapas
    ] == [(5, 1, 5), (6, 1, 8), (7, 2, 10)]
    assert catalogo.despertar is not None
    assert [(a.nivel, a.suma) for a in catalogo.despertar.aumentos_por_nivel] == [
        (1, 5),
        (45, 5),
        (55, 10),
        (60, 10),
    ]
    assert catalogo.personalidad is not None
    assert set(catalogo.personalidad) == set("EINSTFJP")
    sin_confirmar = {k for k, d in catalogo.personalidad.items() if not d.letra_confirmada}
    assert sin_confirmar == set("ITFJ")
    assert catalogo.personalidad["E"].nombre == "Energetic"
    objeto_x = next(o for o in catalogo.objetos or () if o.id == "ejemplo-objeto-x")
    assert objeto_x.bono_potencial is not None
    assert objeto_x.bono_potencial.desde_nivel == 2
    assert dict(objeto_x.bono_potencial.stats) == {Stat.ATQ: 2}


def test_el_archivo_del_repo_reproduce_los_casos_de_referencia() -> None:
    catalogo = leer_catalogo(RUTA_POR_DEFECTO)
    assert isinstance(catalogo, Catalogo)

    r1 = calcular_sugerencia(catalogo, entrada(nivel=60))
    r2 = calcular_sugerencia(catalogo, entrada(nivel=30))
    caso = {"nivel": 30, "atq": 10, "etapa_estrella": 1, "personalidad": "ENFJ"}
    r3 = calcular_sugerencia(catalogo, entrada(**caso))
    r7 = calcular_sugerencia(catalogo, entrada(**caso, objetos=(objeto_equipado(),)))
    r11 = calcular_sugerencia(catalogo, entrada(**caso, objetos=(objeto_equipado(nivel=2),)))
    r12 = calcular_sugerencia(catalogo, entrada(nivel=60, atq=18, etapa_estrella=5))

    assert r1.stats[Stat.ATQ].valor == 690
    assert r2.stats[Stat.ATQ].valor == 390
    assert r2.stats[Stat.ATQ].aproximado is True
    assert r3.stats[Stat.ATQ].valor == 474
    assert r7.stats[Stat.ATQ].valor_con_objetos == 522
    assert r7.objetos[0].aplicado is True
    assert r7.cp.valor == 594
    assert r7.cp.valor_con_objetos == 642
    assert r7.sin_datos == ()
    assert r11.stats[Stat.ATQ].valor_con_objetos == 559
    assert r12.stats[Stat.ATQ].valor == 956


def test_el_archivo_del_repo_funciona_con_la_otra_especie_y_el_otro_objeto() -> None:
    catalogo = leer_catalogo(RUTA_POR_DEFECTO)
    assert isinstance(catalogo, Catalogo)
    objeto = ObjetoDeLaEntrada(PosicionObjeto.EQUIPADO, "ejemplo-objeto-y", 1)

    resultado = calcular_sugerencia(
        catalogo, entrada(especie_id="ejemplo-b", nivel=1, objetos=(objeto,))
    )

    assert all(s.valor is not None for s in resultado.stats.values())
    assert resultado.stats[Stat.PS].valor_con_objetos != resultado.stats[Stat.PS].valor
