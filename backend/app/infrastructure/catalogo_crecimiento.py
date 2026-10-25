import json
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    ValidationError,
)
from pydantic_core import ErrorDetails

from app.domain.catalogos import Stat
from app.domain.crecimiento import (
    AumentoDeCupo,
    BonoDePotencialDeObjeto,
    CambioConocido,
    Catalogo,
    Confianza,
    Especie,
    EtapaDeEstrella,
    EtapaDeEstrellaConBonos,
    EtapasDeEstrella,
    FormulaDeCp,
    Interpolacion,
    LetraDePersonalidad,
    Modificador,
    ModificadoresPorStat,
    NivelDeObjeto,
    ObjetoDelCatalogo,
    OtroEfecto,
    ParametrosDeDespertar,
    ParametrosDePotencial,
    PuntoMedido,
    Redondeo,
    TipoDeModificador,
)

RUTA_POR_DEFECTO = Path(__file__).resolve().parents[2] / "datos" / "catalogo_crecimiento.json"
TAMANO_MAXIMO = 1024 * 1024

StatClave = Literal["ps", "atq", "def_fisica", "def_magica", "regen", "quiebre"]
LetraClave = Literal["E", "I", "N", "S", "T", "F", "J", "P"]
ConfianzaClave = Literal["oficial", "medido", "fan", "inferido", "contradictorio", "ejemplo"]
_PATRON_ID = r"^[a-z0-9-]{1,50}$"
_PATRON_FECHA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_FECHA_MINIMA = date(2020, 1, 1)
_FECHA_MAXIMA = date(2099, 12, 31)
_MENSAJE_FORMATO_ANTERIOR = (
    "formato: el catálogo tiene el formato anterior (C-08); este backend requiere formato 2"
)


@dataclass(frozen=True, slots=True)
class ErrorDeCatalogo:
    errores: tuple[str, ...]


def _a_decimal(valor: object) -> Decimal:
    if isinstance(valor, bool) or not isinstance(valor, int | Decimal):
        raise ValueError("debe ser un número")
    return Decimal(valor)


def _sin_tipos_repetidos(modificadores: list["ModificadorDatos"]) -> list["ModificadorDatos"]:
    if len({m.tipo for m in modificadores}) != len(modificadores):
        raise ValueError("no puede haber dos modificadores del mismo tipo")
    return modificadores


def _a_fecha(valor: str) -> date:
    if _PATRON_FECHA.fullmatch(valor) is None:
        raise ValueError("debe tener el formato AAAA-MM-DD")
    try:
        fecha = date.fromisoformat(valor)
    except ValueError:
        raise ValueError("no es una fecha válida") from None
    if not _FECHA_MINIMA <= fecha <= _FECHA_MAXIMA:
        raise ValueError("debe estar entre 2020-01-01 y 2099-12-31")
    return fecha


def _fecha_valida(valor: str) -> str:
    _a_fecha(valor)
    return valor


Porcentaje = Annotated[Decimal, BeforeValidator(_a_decimal), Field(ge=0, le=100)]
Fecha = Annotated[str, AfterValidator(_fecha_valida)]
Peso = Annotated[Decimal, BeforeValidator(_a_decimal), Field(ge=-1000, le=1000)]
Constante = Annotated[Decimal, BeforeValidator(_a_decimal), Field(ge=-9_999_999, le=9_999_999)]


class _Datos(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ModificadorDatos(_Datos):
    tipo: Literal["porcentaje", "plano"]
    valor: Peso


ListaDeModificadores = Annotated[
    list[ModificadorDatos],
    Field(min_length=1, max_length=2),
    AfterValidator(_sin_tipos_repetidos),
]
ModificadoresDatos = dict[StatClave, ListaDeModificadores]


class PuntoDatos(_Datos):
    nivel: int = Field(ge=1, le=999)
    valor: int = Field(ge=0, le=9_999_999)


CurvaDatos = Annotated[list[PuntoDatos], Field(min_length=1, max_length=200)]


class BaseDatos(_Datos):
    ps: CurvaDatos
    atq: CurvaDatos
    def_fisica: CurvaDatos
    def_magica: CurvaDatos
    regen: CurvaDatos
    quiebre: CurvaDatos


class EspecieDatos(_Datos):
    id: str = Field(pattern=_PATRON_ID)
    nombre: str = Field(min_length=1, max_length=50)
    base: BaseDatos


class EstrellaDatos(_Datos):
    etapa: int = Field(ge=1, le=7)
    modificadores: ModificadoresDatos


class SaltoDatos(_Datos):
    cada: int = Field(ge=1, le=20)
    porcentaje: Porcentaje


class PotencialDatos(_Datos):
    confianza: ConfianzaClave
    por_punto: Porcentaje
    salto: SaltoDatos
    cuenta_estrella: bool
    cuenta_objeto: bool


class EtapaConBonosDatos(_Datos):
    etapa: int = Field(ge=1, le=7)
    bono_potencial: int = Field(ge=0, le=20)
    bono_cupo: int = Field(ge=0, le=999)


class EtapasDeEstrellaDatos(_Datos):
    confianza: ConfianzaClave
    etapas: list[EtapaConBonosDatos] = Field(min_length=1, max_length=7)


class AumentoDatos(_Datos):
    nivel: int = Field(ge=1, le=999)
    suma: int = Field(ge=0, le=999)


class DespertarDatos(_Datos):
    confianza: ConfianzaClave
    aumentos_por_nivel: list[AumentoDatos] = Field(min_length=1, max_length=100)


class OtroEfectoDatos(_Datos):
    descripcion: str = Field(min_length=1, max_length=60)
    porcentaje: Peso


class LetraDatos(_Datos):
    nombre: str = Field(min_length=1, max_length=30)
    letra_confirmada: bool
    confianza: ConfianzaClave
    modificadores: ModificadoresDatos
    otros: list[OtroEfectoDatos] = Field(default_factory=list, max_length=3)


class CambioConocidoDatos(_Datos):
    fecha: Fecha
    descripcion: str = Field(min_length=1, max_length=200)
    confianza: ConfianzaClave


class NivelDeObjetoDatos(_Datos):
    nivel: int = Field(ge=1, le=99)
    modificadores: ModificadoresDatos


class BonoDePotencialDatos(_Datos):
    desde_nivel: int = Field(ge=1, le=99)
    stats: dict[StatClave, Annotated[int, Field(ge=1, le=10)]] = Field(min_length=1, max_length=6)


class ObjetoDatos(_Datos):
    id: str = Field(pattern=_PATRON_ID)
    nombre: str = Field(min_length=1, max_length=50)
    bono_potencial: BonoDePotencialDatos | None = None
    niveles: list[NivelDeObjetoDatos] = Field(min_length=1, max_length=99)


class CpDatos(_Datos):
    constante: Constante = Decimal(0)
    pesos: dict[StatClave, Peso]
    por_punto_de_potencial: Peso | None = None


class CatalogoDatos(_Datos):
    formato: Literal[2]
    version: str = Field(min_length=1, max_length=50)
    es_ejemplo: bool
    estimacion_verificada: bool
    fecha_parche: Fecha
    cambios_conocidos: list[CambioConocidoDatos] = Field(default_factory=list, max_length=50)
    redondeo: Literal["abajo", "cercano", "arriba"]
    interpolacion: Literal["ninguna", "lineal"]
    especies: list[EspecieDatos] = Field(min_length=1, max_length=500)
    potencial: PotencialDatos | None = None
    etapas_de_estrella: EtapasDeEstrellaDatos | None = None
    despertar: DespertarDatos | None = None
    estrellas: list[EstrellaDatos] | None = Field(default=None, max_length=7)
    personalidad: dict[LetraClave, LetraDatos] | None = None
    objetos: list[ObjetoDatos] | None = Field(default=None, max_length=500)
    cp: CpDatos | None = None


def _ruta_del_campo(ubicacion: tuple[int | str, ...]) -> str:
    ruta = ""
    for parte in ubicacion:
        if parte == "[key]":
            continue
        ruta += f"[{parte}]" if isinstance(parte, int) else f".{parte}" if ruta else str(parte)
    return ruta or "archivo"


def _motivo_de_clave(ubicacion: tuple[int | str, ...]) -> str:
    clave = ubicacion[-2]
    if len(ubicacion) == 3 and ubicacion[0] == "personalidad":
        return f"'{clave}' no es una letra de personalidad conocida"
    return f"'{clave}' no es un stat conocido"


def _motivo(error: ErrorDetails) -> str:
    tipo = error["type"]
    contexto = error.get("ctx", {})
    ubicacion = error["loc"]
    if tipo == "literal_error" and ubicacion and ubicacion[-1] == "[key]":
        return _motivo_de_clave(ubicacion)
    if tipo == "value_error":
        return str(contexto["error"])
    plantillas = {
        "extra_forbidden": "campo no permitido",
        "missing": "falta el campo",
        "int_type": "debe ser un número entero",
        "bool_type": "debe ser verdadero o falso",
        "string_type": "debe ser texto",
        "dict_type": "debe ser un objeto",
        "model_type": "debe ser un objeto",
        "list_type": "debe ser una lista",
        "greater_than_equal": "debe ser mayor o igual a {ge}",
        "less_than_equal": "debe ser menor o igual a {le}",
        "too_short": "debe tener al menos {min_length} elementos",
        "too_long": "debe tener como máximo {max_length} elementos",
        "string_too_short": "debe tener al menos {min_length} caracteres",
        "string_too_long": "debe tener como máximo {max_length} caracteres",
        "string_pattern_mismatch": (
            "formato inválido: solo minúsculas, números y guiones, hasta 50 caracteres"
        ),
        "literal_error": "debe ser uno de: {expected}",
    }
    plantilla = plantillas.get(tipo, "valor inválido")
    return plantilla.format(**contexto).replace("' or '", "' o '")


def _errores_de_esquema(error: ValidationError) -> list[str]:
    return [f"{_ruta_del_campo(e['loc'])}: {_motivo(e)}" for e in error.errors()]


def _enteros(items: object, campo: str) -> list[tuple[int, int]]:
    if not isinstance(items, list):
        return []
    encontrados: list[tuple[int, int]] = []
    for posicion, item in enumerate(items):
        valor = item.get(campo) if isinstance(item, dict) else None
        if isinstance(valor, int) and not isinstance(valor, bool):
            encontrados.append((posicion, valor))
    return encontrados


def _niveles_no_crecientes(
    items: object, ruta: str, campo: str, anterior: str = "el nivel anterior"
) -> list[str]:
    errores: list[str] = []
    maximo: int | None = None
    for posicion, valor in _enteros(items, campo):
        if maximo is not None and valor <= maximo:
            errores.append(f"{ruta}[{posicion}].{campo}: debe ser mayor que {anterior}")
        maximo = valor if maximo is None else max(maximo, valor)
    return errores


def _repetidos(items: object, ruta: str, campo: str, motivo: str) -> list[str]:
    if not isinstance(items, list):
        return []
    vistos: set[object] = set()
    errores: list[str] = []
    for posicion, item in enumerate(items):
        valor = item.get(campo) if isinstance(item, dict) else None
        if not isinstance(valor, str | int) or isinstance(valor, bool):
            continue
        if valor in vistos:
            errores.append(f"{ruta}[{posicion}].{campo}: {motivo}")
        vistos.add(valor)
    return errores


def _fechas_no_crecientes(items: object, ruta: str) -> list[str]:
    if not isinstance(items, list):
        return []
    errores: list[str] = []
    ultima: date | None = None
    for posicion, item in enumerate(items):
        texto = item.get("fecha") if isinstance(item, dict) else None
        try:
            fecha = _a_fecha(texto) if isinstance(texto, str) else None
        except ValueError:
            fecha = None
        if fecha is None:
            continue
        if ultima is not None and fecha <= ultima:
            errores.append(f"{ruta}[{posicion}].fecha: debe ser posterior a la fecha anterior")
        ultima = fecha if ultima is None else max(ultima, fecha)
    return errores


def _primer_nivel_de_despertar(items: object, ruta: str) -> list[str]:
    enteros = _enteros(items, "nivel")
    if enteros and enteros[0][0] == 0 and enteros[0][1] != 1:
        return [f"{ruta}[0].nivel: el primer nivel debe ser 1"]
    return []


def _seccion(datos: dict[object, object], nombre: str) -> dict[object, object]:
    seccion = datos.get(nombre)
    return seccion if isinstance(seccion, dict) else {}


def _reglas_cruzadas(datos: object) -> list[str]:
    if not isinstance(datos, dict):
        return []
    errores: list[str] = []
    especies = datos.get("especies")
    errores += _repetidos(especies, "especies", "id", "id repetido")
    for i, especie in enumerate(especies if isinstance(especies, list) else []):
        base = especie.get("base") if isinstance(especie, dict) else None
        for stat in Stat:
            curva = base.get(stat.value) if isinstance(base, dict) else None
            errores += _niveles_no_crecientes(curva, f"especies[{i}].base.{stat.value}", "nivel")
    errores += _repetidos(datos.get("estrellas"), "estrellas", "etapa", "etapa repetida")
    errores += _fechas_no_crecientes(datos.get("cambios_conocidos"), "cambios_conocidos")
    etapas = _seccion(datos, "etapas_de_estrella").get("etapas")
    errores += _niveles_no_crecientes(
        etapas, "etapas_de_estrella.etapas", "etapa", "la etapa anterior"
    )
    aumentos = _seccion(datos, "despertar").get("aumentos_por_nivel")
    errores += _primer_nivel_de_despertar(aumentos, "despertar.aumentos_por_nivel")
    errores += _niveles_no_crecientes(aumentos, "despertar.aumentos_por_nivel", "nivel")
    objetos = datos.get("objetos")
    errores += _repetidos(objetos, "objetos", "id", "id repetido")
    for i, objeto in enumerate(objetos if isinstance(objetos, list) else []):
        niveles = objeto.get("niveles") if isinstance(objeto, dict) else None
        errores += _niveles_no_crecientes(niveles, f"objetos[{i}].niveles", "nivel")
    return errores


def _modificadores(datos: ModificadoresDatos) -> ModificadoresPorStat:
    return {
        Stat(stat): tuple(Modificador(TipoDeModificador(m.tipo), m.valor) for m in lista)
        for stat, lista in datos.items()
    }


def _potencial(datos: PotencialDatos) -> ParametrosDePotencial:
    return ParametrosDePotencial(
        confianza=Confianza(datos.confianza),
        por_punto=datos.por_punto,
        salto_cada=datos.salto.cada,
        salto_porcentaje=datos.salto.porcentaje,
        cuenta_estrella=datos.cuenta_estrella,
        cuenta_objeto=datos.cuenta_objeto,
    )


def _letra(datos: LetraDatos) -> LetraDePersonalidad:
    return LetraDePersonalidad(
        nombre=datos.nombre,
        letra_confirmada=datos.letra_confirmada,
        confianza=Confianza(datos.confianza),
        modificadores=_modificadores(datos.modificadores),
        otros=tuple(OtroEfecto(o.descripcion, o.porcentaje) for o in datos.otros),
    )


def _objeto(datos: ObjetoDatos) -> ObjetoDelCatalogo:
    bono = datos.bono_potencial
    return ObjetoDelCatalogo(
        id=datos.id,
        nombre=datos.nombre,
        niveles=tuple(
            NivelDeObjeto(n.nivel, _modificadores(n.modificadores)) for n in datos.niveles
        ),
        bono_potencial=None
        if bono is None
        else BonoDePotencialDeObjeto(
            bono.desde_nivel, {Stat(stat): puntos for stat, puntos in bono.stats.items()}
        ),
    )


def _a_dominio(datos: CatalogoDatos) -> Catalogo:
    especies = tuple(
        Especie(
            id=e.id,
            nombre=e.nombre,
            base={
                stat: tuple(PuntoMedido(p.nivel, p.valor) for p in getattr(e.base, stat.value))
                for stat in Stat
            },
        )
        for e in datos.especies
    )
    cp = None
    if datos.cp is not None:
        cp = FormulaDeCp(
            constante=datos.cp.constante,
            pesos={Stat(stat): peso for stat, peso in datos.cp.pesos.items()},
            por_punto_de_potencial=datos.cp.por_punto_de_potencial,
        )
    etapas = datos.etapas_de_estrella
    despertar = datos.despertar
    return Catalogo(
        formato=datos.formato,
        version=datos.version,
        es_ejemplo=datos.es_ejemplo,
        estimacion_verificada=datos.estimacion_verificada,
        fecha_parche=_a_fecha(datos.fecha_parche),
        cambios_conocidos=tuple(
            CambioConocido(_a_fecha(c.fecha), c.descripcion, Confianza(c.confianza))
            for c in datos.cambios_conocidos
        ),
        redondeo=Redondeo(datos.redondeo),
        interpolacion=Interpolacion(datos.interpolacion),
        especies=especies,
        potencial=None if datos.potencial is None else _potencial(datos.potencial),
        etapas_de_estrella=None
        if etapas is None
        else EtapasDeEstrella(
            Confianza(etapas.confianza),
            tuple(
                EtapaDeEstrellaConBonos(e.etapa, e.bono_potencial, e.bono_cupo)
                for e in etapas.etapas
            ),
        ),
        despertar=None
        if despertar is None
        else ParametrosDeDespertar(
            Confianza(despertar.confianza),
            tuple(AumentoDeCupo(a.nivel, a.suma) for a in despertar.aumentos_por_nivel),
        ),
        estrellas=None
        if datos.estrellas is None
        else tuple(
            EtapaDeEstrella(e.etapa, _modificadores(e.modificadores)) for e in datos.estrellas
        ),
        personalidad=None
        if datos.personalidad is None
        else {letra: _letra(dl) for letra, dl in datos.personalidad.items()},
        objetos=None if datos.objetos is None else tuple(_objeto(o) for o in datos.objetos),
        cp=cp,
    )


def _rechazar_constante(nombre: str) -> None:
    raise ValueError(f"constante no permitida: {nombre}")


def _leer_json(ruta: Path) -> object | ErrorDeCatalogo:
    try:
        with ruta.open("rb") as archivo:
            contenido = archivo.read(TAMANO_MAXIMO + 1)
    except OSError:
        return ErrorDeCatalogo((f"archivo: no se pudo leer {ruta}",))
    if len(contenido) > TAMANO_MAXIMO:
        return ErrorDeCatalogo(("archivo: pesa más de 1 MiB, no se leyó",))
    try:
        texto = contenido.decode("utf-8-sig")
    except UnicodeDecodeError:
        return ErrorDeCatalogo(("archivo: no es UTF-8 válido",))
    try:
        return json.loads(texto, parse_float=Decimal, parse_constant=_rechazar_constante)
    except json.JSONDecodeError as error:
        return ErrorDeCatalogo(
            (f"archivo: no es JSON válido (línea {error.lineno}, columna {error.colno})",)
        )
    except (ValueError, RecursionError):
        return ErrorDeCatalogo(("archivo: no es JSON válido",))


def _es_formato_2(valor: object) -> bool:
    return isinstance(valor, int) and not isinstance(valor, bool) and valor == 2


def leer_catalogo(ruta: Path) -> Catalogo | ErrorDeCatalogo:
    crudo = _leer_json(ruta)
    if isinstance(crudo, ErrorDeCatalogo):
        return crudo
    if isinstance(crudo, dict) and not _es_formato_2(crudo.get("formato")):
        return ErrorDeCatalogo((_MENSAJE_FORMATO_ANTERIOR,))
    errores: list[str] = []
    datos: CatalogoDatos | None = None
    try:
        datos = CatalogoDatos.model_validate(crudo)
    except ValidationError as error:
        errores = _errores_de_esquema(error)
    errores += _reglas_cruzadas(crudo)
    if errores or datos is None:
        return ErrorDeCatalogo(tuple(dict.fromkeys(errores)))
    return _a_dominio(datos)
