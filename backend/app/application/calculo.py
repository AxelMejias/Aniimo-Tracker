from dataclasses import dataclass

from app.domain.crecimiento import (
    Catalogo,
    EntradaDeCalculo,
    Sugerencia,
    calcular_sugerencia,
    secciones_sin_datos,
)
from app.domain.errores import CalculoNoDisponible


@dataclass(frozen=True, slots=True)
class ElementoDelResumen:
    id: str
    nombre: str


@dataclass(frozen=True, slots=True)
class ResumenDeCatalogo:
    version: str
    es_ejemplo: bool
    especies: tuple[ElementoDelResumen, ...]
    objetos: tuple[ElementoDelResumen, ...]
    sin_datos: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CalculoRealizado:
    version: str
    es_ejemplo: bool
    sugerencia: Sugerencia


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
            version=catalogo.version,
            es_ejemplo=catalogo.es_ejemplo,
            especies=tuple(ElementoDelResumen(e.id, e.nombre) for e in catalogo.especies),
            objetos=tuple(ElementoDelResumen(o.id, o.nombre) for o in catalogo.objetos or ()),
            sin_datos=secciones_sin_datos(catalogo),
        )

    def calcular(self, entrada: EntradaDeCalculo) -> CalculoRealizado:
        catalogo = self._disponible()
        return CalculoRealizado(
            version=catalogo.version,
            es_ejemplo=catalogo.es_ejemplo,
            sugerencia=calcular_sugerencia(catalogo, entrada),
        )
