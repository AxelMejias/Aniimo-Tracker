import copy
import json
from collections.abc import Callable
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    Catalogo,
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
        "version": "ejemplo-test",
        "es_ejemplo": True,
        "redondeo": "abajo",
        "interpolacion": "lineal",
        "especies": [
            {"id": "ejemplo-a", "nombre": "EJEMPLO A", "base": _base()},
            {"id": "ejemplo-b", "nombre": "EJEMPLO B", "base": _base()},
        ],
        "potencial": {
            "atq": {"tipo": "porcentaje", "valor": 1},
            "ps": {"tipo": "plano", "valor": 10},
        },
        "estrellas": [
            {"estrella": 1, "modificadores": {"atq": [{"tipo": "plano", "valor": 10}]}},
            {"estrella": 2, "modificadores": {"atq": [{"tipo": "plano", "valor": 20}]}},
        ],
        "personalidad": {"E": {"atq": [{"tipo": "porcentaje", "valor": 5}]}},
        "objetos": [
            {
                "id": "ejemplo-objeto-x",
                "nombre": "EJEMPLO Objeto X",
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
    assert catalogo.potencial is not None
    assert catalogo.potencial[Stat.ATQ].tipo is TipoDeModificador.PORCENTAJE
    assert catalogo.cp is not None
    assert catalogo.cp.pesos[Stat.PS] == Decimal("0.5")
    assert isinstance(catalogo.cp.pesos[Stat.PS], Decimal)
    assert catalogo.cp.por_punto_de_potencial == Decimal(2)
    assert catalogo.objetos is not None
    assert catalogo.objetos[0].niveles[1].modificadores[Stat.ATQ][0].valor == Decimal("6.5")


def test_las_secciones_opcionales_pueden_faltar(tmp_path: Path) -> None:
    datos = datos_validos()
    for seccion in ("potencial", "estrellas", "personalidad", "objetos", "cp"):
        del datos[seccion]

    catalogo = catalogo_de(tmp_path, datos)

    assert catalogo.potencial is None
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
    d["potencial"]["atq"]["valor"] = "5"


def _modificador_booleano(d: Datos) -> None:
    d["potencial"]["atq"]["valor"] = True


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
    d["potencial"]["atq"]["tipo"] = "multiplicar"


def _letra_x(d: Datos) -> None:
    d["personalidad"]["X"] = {"atq": [{"tipo": "plano", "valor": 1}]}


def _estrella_repetida(d: Datos) -> None:
    d["estrellas"][1]["estrella"] = 1


def _modificador_fuera_de_rango(d: Datos) -> None:
    d["potencial"]["atq"]["valor"] = 1001


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


CASOS_INVALIDOS: list[tuple[Mutacion, str, str]] = [
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
    (_modificador_como_string, "potencial.atq.valor", "número"),
    (_modificador_booleano, "potencial.atq.valor", "número"),
    (_sin_es_ejemplo, "es_ejemplo", "falta"),
    (_es_ejemplo_como_string, "es_ejemplo", "verdadero o falso"),
    (_especie_repetida, "especies[1].id", "repetido"),
    (_objeto_repetido, "objetos[1].id", "repetido"),
    (_id_con_mayusculas, "especies[0].id", "formato"),
    (_id_con_ruta, "objetos[0].id", "formato"),
    (_multiplicar, "potencial.atq.tipo", "porcentaje"),
    (_letra_x, "personalidad.X", "letra de personalidad"),
    (_estrella_repetida, "estrellas[1].estrella", "repetida"),
    (_modificador_fuera_de_rango, "potencial.atq.valor", "menor o igual a 1000"),
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
    assert any(e.startswith("potencial.atq.tipo") for e in errores)


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
    assert resultado.es_ejemplo is True
    assert resultado.objetos
    assert resultado.cp is not None
    assert all(e.nombre.startswith("EJEMPLO") for e in resultado.especies)
    assert all(o.nombre.startswith("EJEMPLO") for o in resultado.objetos)
    assert {e.id for e in resultado.especies} >= {"ejemplo-a", "ejemplo-b"}
    assert {o.id for o in resultado.objetos} >= {"ejemplo-objeto-x", "ejemplo-objeto-y"}


def test_el_archivo_del_repo_reproduce_los_casos_de_referencia() -> None:
    catalogo = leer_catalogo(RUTA_POR_DEFECTO)
    assert isinstance(catalogo, Catalogo)

    r1 = calcular_sugerencia(catalogo, entrada(nivel=60))
    r2 = calcular_sugerencia(catalogo, entrada(nivel=30))
    caso = {"nivel": 30, "atq": 10, "estrella_actual": 1, "personalidad": "ENFJ"}
    r3 = calcular_sugerencia(catalogo, entrada(**caso))
    r7 = calcular_sugerencia(catalogo, entrada(**caso, objetos=(objeto_equipado(),)))

    assert r1.stats[Stat.ATQ].valor == 690
    assert r2.stats[Stat.ATQ].valor == 390
    assert r2.stats[Stat.ATQ].aproximado is True
    assert r3.stats[Stat.ATQ].valor == 458
    assert r7.stats[Stat.ATQ].valor_con_objetos == 509
    assert r7.objetos[0].aplicado is True
    assert r7.cp.valor == 578
    assert r7.cp.valor_con_objetos == 629
    assert r7.sin_datos == ()


def test_el_archivo_del_repo_funciona_con_la_otra_especie_y_el_otro_objeto() -> None:
    catalogo = leer_catalogo(RUTA_POR_DEFECTO)
    assert isinstance(catalogo, Catalogo)
    objeto = ObjetoDeLaEntrada(PosicionObjeto.EQUIPADO, "ejemplo-objeto-y", 1)

    resultado = calcular_sugerencia(
        catalogo, entrada(especie_id="ejemplo-b", nivel=1, objetos=(objeto,))
    )

    assert all(s.valor is not None for s in resultado.stats.values())
    assert resultado.stats[Stat.PS].valor_con_objetos != resultado.stats[Stat.PS].valor
