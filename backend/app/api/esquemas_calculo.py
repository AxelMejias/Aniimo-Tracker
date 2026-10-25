from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.application.calculo import CalculoRealizado, ElementoDelResumen, ResumenDeCatalogo
from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    EntradaDeCalculo,
    ObjetoDeLaEntrada,
    ResultadoDeObjeto,
    SugerenciaDeValor,
    TerminoDeDesglose,
)

_ESTRICTO = ConfigDict(extra="forbid", strict=True)

IdDeCatalogo = Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{1,50}$")]
Personalidad = Annotated[str, StringConstraints(pattern=r"^[EI][NS][TF][JP]$")] | None
PosicionDeObjeto = Annotated[PosicionObjeto, Field(strict=False)]
PotencialDeStat = Annotated[int, Field(ge=0, le=20)]


class PotencialesEntrada(BaseModel):
    model_config = _ESTRICTO

    ps: PotencialDeStat
    atq: PotencialDeStat
    def_fisica: PotencialDeStat
    def_magica: PotencialDeStat
    regen: PotencialDeStat
    quiebre: PotencialDeStat


class ObjetoEntrada(BaseModel):
    model_config = _ESTRICTO

    posicion: PosicionDeObjeto
    objeto_id: IdDeCatalogo | None
    nivel: int = Field(ge=1, le=99)


class CalculoEntrada(BaseModel):
    model_config = _ESTRICTO

    especie_id: IdDeCatalogo
    nivel: int = Field(ge=1, le=999)
    potenciales: PotencialesEntrada
    estrella_actual: int = Field(ge=0, le=99)
    personalidad: Personalidad = None
    objetos: list[ObjetoEntrada] = Field(default_factory=list, max_length=2)

    @model_validator(mode="after")
    def _posiciones_unicas(self) -> Self:
        posiciones = [objeto.posicion for objeto in self.objetos]
        if len(set(posiciones)) != len(posiciones):
            raise ValueError("Las posiciones de los objetos no pueden repetirse")
        return self

    def a_dominio(self) -> EntradaDeCalculo:
        return EntradaDeCalculo(
            especie_id=self.especie_id,
            nivel=self.nivel,
            potenciales={stat: getattr(self.potenciales, stat.value) for stat in Stat},
            estrella_actual=self.estrella_actual,
            personalidad=self.personalidad,
            objetos=tuple(
                ObjetoDeLaEntrada(o.posicion, o.objeto_id, o.nivel) for o in self.objetos
            ),
        )


class ElementoSalida(BaseModel):
    id: str
    nombre: str

    @classmethod
    def desde(cls, elemento: ElementoDelResumen) -> Self:
        return cls(id=elemento.id, nombre=elemento.nombre)


class CatalogoSalida(BaseModel):
    version: str
    es_ejemplo: bool
    especies: list[ElementoSalida]
    objetos: list[ElementoSalida]
    sin_datos: list[str]

    @classmethod
    def desde(cls, resumen: ResumenDeCatalogo) -> Self:
        return cls(
            version=resumen.version,
            es_ejemplo=resumen.es_ejemplo,
            especies=[ElementoSalida.desde(e) for e in resumen.especies],
            objetos=[ElementoSalida.desde(o) for o in resumen.objetos],
            sin_datos=list(resumen.sin_datos),
        )


class TerminoSalida(BaseModel):
    origen: str
    detalle: str
    tipo: str
    valor: float

    @classmethod
    def desde(cls, termino: TerminoDeDesglose) -> Self:
        return cls(
            origen=termino.origen,
            detalle=termino.detalle,
            tipo=termino.tipo.value,
            valor=float(termino.valor),
        )


class ValorSugeridoSalida(BaseModel):
    valor: int | None
    valor_con_objetos: int | None
    aproximado: bool
    motivo: str | None
    desglose: list[TerminoSalida]

    @classmethod
    def desde(cls, sugerido: SugerenciaDeValor) -> Self:
        return cls(
            valor=sugerido.valor,
            valor_con_objetos=sugerido.valor_con_objetos,
            aproximado=sugerido.aproximado,
            motivo=None if sugerido.motivo is None else sugerido.motivo.value,
            desglose=[TerminoSalida.desde(t) for t in sugerido.desglose],
        )


class ObjetoSalida(BaseModel):
    posicion: PosicionObjeto
    aplicado: bool
    nota: str | None

    @classmethod
    def desde(cls, resultado: ResultadoDeObjeto) -> Self:
        return cls(
            posicion=resultado.posicion,
            aplicado=resultado.aplicado,
            nota=None if resultado.nota is None else resultado.nota.value,
        )


class CalculoSalida(BaseModel):
    version: str
    es_ejemplo: bool
    stats: dict[Stat, ValorSugeridoSalida]
    cp: ValorSugeridoSalida
    objetos: list[ObjetoSalida]
    sin_datos: list[str]

    @classmethod
    def desde(cls, calculo: CalculoRealizado) -> Self:
        sugerencia = calculo.sugerencia
        return cls(
            version=calculo.version,
            es_ejemplo=calculo.es_ejemplo,
            stats={stat: ValorSugeridoSalida.desde(v) for stat, v in sugerencia.stats.items()},
            cp=ValorSugeridoSalida.desde(sugerencia.cp),
            objetos=[ObjetoSalida.desde(o) for o in sugerencia.objetos],
            sin_datos=list(sugerencia.sin_datos),
        )
