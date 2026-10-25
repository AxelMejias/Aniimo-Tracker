import json
from dataclasses import dataclass
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
    Catalogo,
    Especie,
    EtapaDeEstrella,
    FormulaDeCp,
    Interpolacion,
    Modificador,
    ModificadoresPorStat,
    NivelDeObjeto,
    ObjetoDelCatalogo,
    PuntoMedido,
    Redondeo,
    TipoDeModificador,
)

RUTA_POR_DEFECTO = Path(__file__).resolve().parents[2] / "datos" / "catalogo_crecimiento.json"
TAMANO_MAXIMO = 1024 * 1024

StatClave = Literal["ps", "atq", "def_fisica", "def_magica", "regen", "quiebre"]
LetraClave = Literal["E", "I", "N", "S", "T", "F", "J", "P"]
_PATRON_ID = r"^[a-z0-9-]{1,50}$"


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
    estrella: int = Field(ge=1, le=99)
    modificadores: ModificadoresDatos


class NivelDeObjetoDatos(_Datos):
    nivel: int = Field(ge=1, le=99)
    modificadores: ModificadoresDatos


class ObjetoDatos(_Datos):
    id: str = Field(pattern=_PATRON_ID)
    nombre: str = Field(min_length=1, max_length=50)
    niveles: list[NivelDeObjetoDatos] = Field(min_length=1, max_length=99)


class CpDatos(_Datos):
    constante: Constante = Decimal(0)
    pesos: dict[StatClave, Peso]
    por_punto_de_potencial: Peso | None = None


class CatalogoDatos(_Datos):
    version: str = Field(min_length=1, max_length=50)
    es_ejemplo: bool
    redondeo: Literal["abajo", "cercano", "arriba"]
    interpolacion: Literal["ninguna", "lineal"]
    especies: list[EspecieDatos] = Field(min_length=1, max_length=500)
    potencial: dict[StatClave, ModificadorDatos] | None = None
    estrellas: list[EstrellaDatos] | None = Field(default=None, max_length=99)
    personalidad: dict[LetraClave, ModificadoresDatos] | None = None
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


def _niveles_no_crecientes(items: object, ruta: str, campo: str) -> list[str]:
    errores: list[str] = []
    maximo: int | None = None
    for posicion, valor in _enteros(items, campo):
        if maximo is not None and valor <= maximo:
            errores.append(f"{ruta}[{posicion}].{campo}: debe ser mayor que el nivel anterior")
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
    errores += _repetidos(datos.get("estrellas"), "estrellas", "estrella", "estrella repetida")
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
    return Catalogo(
        version=datos.version,
        es_ejemplo=datos.es_ejemplo,
        redondeo=Redondeo(datos.redondeo),
        interpolacion=Interpolacion(datos.interpolacion),
        especies=especies,
        potencial=None
        if datos.potencial is None
        else {
            Stat(stat): Modificador(TipoDeModificador(m.tipo), m.valor)
            for stat, m in datos.potencial.items()
        },
        estrellas=None
        if datos.estrellas is None
        else tuple(
            EtapaDeEstrella(e.estrella, _modificadores(e.modificadores)) for e in datos.estrellas
        ),
        personalidad=None
        if datos.personalidad is None
        else {letra: _modificadores(m) for letra, m in datos.personalidad.items()},
        objetos=None
        if datos.objetos is None
        else tuple(
            ObjetoDelCatalogo(
                id=o.id,
                nombre=o.nombre,
                niveles=tuple(
                    NivelDeObjeto(n.nivel, _modificadores(n.modificadores)) for n in o.niveles
                ),
            )
            for o in datos.objetos
        ),
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


def leer_catalogo(ruta: Path) -> Catalogo | ErrorDeCatalogo:
    crudo = _leer_json(ruta)
    if isinstance(crudo, ErrorDeCatalogo):
        return crudo
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
