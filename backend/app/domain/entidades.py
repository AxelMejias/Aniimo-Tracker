import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from types import MappingProxyType
from uuid import UUID, uuid4

from app.domain.catalogos import Elemento, PosicionObjeto, PotencialInnato, Rareza, Rol, Stat
from app.domain.errores import (
    DespertaresInconsistentes,
    LimiteDeTeamsAlcanzado,
    PersonalidadInvalida,
    PotencialFueraDeRango,
    SlotInvalido,
    ValorInvalido,
)

_PERSONALIDAD = re.compile(r"[EI][NS][TF][JP]")
_MAX_MATERIALES = 3
_MAX_OBJETOS = 2
_POTENCIAL_MAX = 20


def normalizar_nombre_usuario(nombre_usuario: str) -> str:
    return nombre_usuario.lower()


def _no_vacio(campo: str, valor: str) -> None:
    if not valor:
        raise ValorInvalido(campo)


def _minimo(campo: str, valor: int, minimo: int) -> None:
    if valor < minimo:
        raise ValorInvalido(campo)


def _entre(campo: str, valor: int, minimo: int, maximo: int) -> None:
    if not minimo <= valor <= maximo:
        raise ValorInvalido(campo)


def _stats_en_cero() -> Mapping[Stat, "ValoresDeStat"]:
    return {stat: ValoresDeStat() for stat in Stat}


@dataclass(frozen=True, slots=True)
class Usuario:
    nombre_usuario: str
    password_hash: str
    id: UUID = field(default_factory=uuid4)
    creado_en: datetime = field(default_factory=lambda: datetime.now(UTC))

    def __post_init__(self) -> None:
        object.__setattr__(self, "nombre_usuario", normalizar_nombre_usuario(self.nombre_usuario))
        _no_vacio("nombre_usuario", self.nombre_usuario)


@dataclass(frozen=True, slots=True)
class Team:
    usuario_id: UUID
    nombre: str
    orden: int
    id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        _no_vacio("nombre", self.nombre)
        if not 1 <= self.orden <= 4:
            raise LimiteDeTeamsAlcanzado


@dataclass(frozen=True, slots=True)
class ValoresDeStat:
    valor_actual: int = 0
    potencial: int = 0
    bono_estrellas_incluido: int = 0
    notas: str | None = None

    def __post_init__(self) -> None:
        _minimo("valor_actual", self.valor_actual, 0)
        _minimo("bono_estrellas_incluido", self.bono_estrellas_incluido, 0)
        if not 0 <= self.potencial <= _POTENCIAL_MAX:
            raise PotencialFueraDeRango


@dataclass(frozen=True, slots=True)
class MaterialEstrella:
    posicion: int
    nombre: str
    tengo: int = 0
    necesito: int = 0

    def __post_init__(self) -> None:
        _entre("posicion", self.posicion, 1, _MAX_MATERIALES)
        _no_vacio("nombre", self.nombre)
        _minimo("tengo", self.tengo, 0)
        _minimo("necesito", self.necesito, 0)


@dataclass(frozen=True, slots=True)
class ObjetoTransportado:
    posicion: PosicionObjeto
    nombre: str
    rareza: Rareza
    nivel: int = 1
    contrato: bool = False
    efecto_nucleo_notas: str | None = None

    def __post_init__(self) -> None:
        _no_vacio("nombre", self.nombre)
        _minimo("nivel", self.nivel, 1)


@dataclass(frozen=True, slots=True)
class AniimoDelTeam:
    team_id: UUID
    slot: int
    nombre: str
    elemento: Elemento | None = None
    rol: Rol | None = None
    potencial_innato: PotencialInnato | None = None
    personalidad: str | None = None
    nivel: int = 1
    cp: int = 0
    stats: Mapping[Stat, ValoresDeStat] = field(default_factory=_stats_en_cero)
    estrella_actual: int = 0
    nivel_requerido_siguiente_etapa: int | None = None
    ganancia_despertar: int = 0
    ganancia_seis_potenciales: int = 0
    despertares_usados: int = 0
    despertares_total: int = 0
    materiales: tuple[MaterialEstrella, ...] = ()
    objetos: tuple[ObjetoTransportado, ...] = ()
    notas_habilidades: str | None = None
    notas: str | None = None
    id: UUID = field(default_factory=uuid4)

    def __post_init__(self) -> None:
        if not 1 <= self.slot <= 4:
            raise SlotInvalido
        _no_vacio("nombre", self.nombre)
        _minimo("nivel", self.nivel, 1)
        _minimo("cp", self.cp, 0)
        if self.personalidad is not None and not _PERSONALIDAD.fullmatch(self.personalidad):
            raise PersonalidadInvalida
        if set(self.stats) != set(Stat):
            raise ValorInvalido("stats")
        object.__setattr__(self, "stats", MappingProxyType(dict(self.stats)))
        self._validar_entrenamiento()
        self._normalizar_colecciones()

    def _validar_entrenamiento(self) -> None:
        _minimo("estrella_actual", self.estrella_actual, 0)
        if self.nivel_requerido_siguiente_etapa is not None:
            _minimo("nivel_requerido_siguiente_etapa", self.nivel_requerido_siguiente_etapa, 1)
        _minimo("ganancia_despertar", self.ganancia_despertar, 0)
        _minimo("ganancia_seis_potenciales", self.ganancia_seis_potenciales, 0)
        _minimo("despertares_usados", self.despertares_usados, 0)
        _minimo("despertares_total", self.despertares_total, 0)
        if self.despertares_usados > self.despertares_total:
            raise DespertaresInconsistentes

    def _normalizar_colecciones(self) -> None:
        # Orden canonico: la igualdad de entidades no debe depender del orden de carga.
        materiales = tuple(sorted(self.materiales, key=lambda m: m.posicion))
        orden_de_objetos = list(PosicionObjeto)
        objetos = tuple(sorted(self.objetos, key=lambda o: orden_de_objetos.index(o.posicion)))
        if len(materiales) > _MAX_MATERIALES or len({m.posicion for m in materiales}) != len(
            materiales
        ):
            raise ValorInvalido("materiales")
        if len(objetos) > _MAX_OBJETOS or len({o.posicion for o in objetos}) != len(objetos):
            raise ValorInvalido("objetos")
        object.__setattr__(self, "materiales", materiales)
        object.__setattr__(self, "objetos", objetos)
