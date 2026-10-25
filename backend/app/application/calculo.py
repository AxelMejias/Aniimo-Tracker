from dataclasses import dataclass
from datetime import date

from app.domain.crecimiento import (
    CambioConocido,
    Catalogo,
    EntradaDeCalculo,
    Sugerencia,
    calcular_sugerencia,
    secciones_sin_datos,
)
from app.domain.errores import CalculoNoDisponible
from app.domain.potencial import (
    EntradaDePotencial,
    ResultadoDePotencial,
    calcular_potencial_efectivo,
)


@dataclass(frozen=True, slots=True)
class ElementoDelResumen:
    id: str
    nombre: str


@dataclass(frozen=True, slots=True)
class ResumenDeCatalogo:
    formato: int
    version: str
    es_ejemplo: bool
    estimacion_verificada: bool
    fecha_parche: date
    cambios_conocidos: tuple[CambioConocido, ...]
    especies: tuple[ElementoDelResumen, ...]
    objetos: tuple[ElementoDelResumen, ...]
    sin_datos: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CalculoRealizado:
    version: str
    es_ejemplo: bool
    estimacion_verificada: bool
    fecha_parche: date
    sugerencia: Sugerencia


@dataclass(frozen=True, slots=True)
class PotencialRealizado:
    version: str
    es_ejemplo: bool
    fecha_parche: date
    resultado: ResultadoDePotencial


class ServicioDeCalculo:
    def __init__(self, catalogo: Catalogo | None) -> None:
        self._catalogo = catalogo

    def _disponible(self) -> Catalogo:
        if self._catalogo is None:
            raise CalculoNoDisponible
        return self._catalogo

    def resumen(self) -> ResumenDeCatalogo:
        catalogo = self._disponible()
        return ResumenDeCatalogo(
            formato=catalogo.formato,
            version=catalogo.version,
            es_ejemplo=catalogo.es_ejemplo,
            estimacion_verificada=catalogo.estimacion_verificada,
            fecha_parche=catalogo.fecha_parche,
            cambios_conocidos=catalogo.cambios_conocidos,
            especies=tuple(ElementoDelResumen(e.id, e.nombre) for e in catalogo.especies),
            objetos=tuple(ElementoDelResumen(o.id, o.nombre) for o in catalogo.objetos or ()),
            sin_datos=secciones_sin_datos(catalogo),
        )

    def calcular(self, entrada: EntradaDeCalculo) -> CalculoRealizado:
        catalogo = self._disponible()
        return CalculoRealizado(
            version=catalogo.version,
            es_ejemplo=catalogo.es_ejemplo,
            estimacion_verificada=catalogo.estimacion_verificada,
            fecha_parche=catalogo.fecha_parche,
            sugerencia=calcular_sugerencia(catalogo, entrada),
        )

    def potencial(self, entrada: EntradaDePotencial) -> PotencialRealizado:
        catalogo = self._disponible()
        return PotencialRealizado(
            version=catalogo.version,
            es_ejemplo=catalogo.es_ejemplo,
            fecha_parche=catalogo.fecha_parche,
            resultado=calcular_potencial_efectivo(catalogo, entrada),
        )
