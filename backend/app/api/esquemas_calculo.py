from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.api.fecha_de_parche import FechaDeParche, a_fecha
from app.application.calculo import (
    CalculoRealizado,
    ElementoDelResumen,
    PotencialRealizado,
    ResumenDeCatalogo,
)
from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    CambioConocido,
    EntradaDeCalculo,
    ObjetoDeLaEntrada,
    ResultadoDeObjeto,
    SugerenciaDeValor,
    TerminoDeDesglose,
)
from app.domain.potencial import (
    BonoDeLetra,
    CupoDeDespertar,
    EntradaDePotencial,
    ObjetoEquipado,
    PotencialDeStat,
    PotencialEfectivo,
    ResultadoDeObjetoDePotencial,
    SlotDePersonalidad,
    TramoDeCupo,
)

_ESTRICTO = ConfigDict(extra="forbid", strict=True)

IdDeCatalogo = Annotated[str, StringConstraints(pattern=r"^[a-z0-9-]{1,50}$")]
Personalidad = Annotated[str, StringConstraints(pattern=r"^[EI][NS][TF][JP]$")] | None
PosicionDeObjeto = Annotated[PosicionObjeto, Field(strict=False)]
PotencialDeStatEntrada = Annotated[int, Field(ge=0, le=20)]


class PotencialesEntrada(BaseModel):
    model_config = _ESTRICTO

    ps: PotencialDeStatEntrada
    atq: PotencialDeStatEntrada
    def_fisica: PotencialDeStatEntrada
    def_magica: PotencialDeStatEntrada
    regen: PotencialDeStatEntrada
    quiebre: PotencialDeStatEntrada

    def por_stat(self) -> dict[Stat, int]:
        return {stat: getattr(self, stat.value) for stat in Stat}


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
    etapa_estrella: int = Field(ge=0, le=7)
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
            potenciales=self.potenciales.por_stat(),
            etapa_estrella=self.etapa_estrella,
            personalidad=self.personalidad,
            objetos=tuple(
                ObjetoDeLaEntrada(o.posicion, o.objeto_id, o.nivel) for o in self.objetos
            ),
        )


class ObjetoEquipadoEntrada(BaseModel):
    model_config = _ESTRICTO

    objeto_id: IdDeCatalogo | None
    nivel: int = Field(ge=1, le=99)


class PotencialEntrada(BaseModel):
    model_config = _ESTRICTO

    nivel: int = Field(ge=1, le=999)
    etapa_estrella: int = Field(ge=0, le=7)
    potenciales: PotencialesEntrada
    personalidad: Personalidad = None
    objeto_equipado: ObjetoEquipadoEntrada | None = None
    despertares_usados: int = Field(ge=0, le=9999)
    despertares_total: int = Field(ge=0, le=9999)
    fecha_parche: FechaDeParche | None = None

    @model_validator(mode="after")
    def _usados_hasta_el_total(self) -> Self:
        if self.despertares_usados > self.despertares_total:
            raise ValueError("Los despertares usados no pueden superar el total")
        return self

    def a_dominio(self) -> EntradaDePotencial:
        equipado = self.objeto_equipado
        return EntradaDePotencial(
            nivel=self.nivel,
            etapa_estrella=self.etapa_estrella,
            potenciales=self.potenciales.por_stat(),
            personalidad=self.personalidad,
            objeto_equipado=None
            if equipado is None
            else ObjetoEquipado(equipado.objeto_id, equipado.nivel),
            despertares_usados=self.despertares_usados,
            despertares_total=self.despertares_total,
            fecha_parche=None if self.fecha_parche is None else a_fecha(self.fecha_parche),
        )


class ElementoSalida(BaseModel):
    id: str
    nombre: str

    @classmethod
    def desde(cls, elemento: ElementoDelResumen) -> Self:
        return cls(id=elemento.id, nombre=elemento.nombre)


class CambioConocidoSalida(BaseModel):
    fecha: str
    descripcion: str
    confianza: str

    @classmethod
    def desde(cls, cambio: CambioConocido) -> Self:
        return cls(
            fecha=cambio.fecha.isoformat(),
            descripcion=cambio.descripcion,
            confianza=cambio.confianza.value,
        )


class CatalogoSalida(BaseModel):
    formato: int
    version: str
    es_ejemplo: bool
    estimacion_verificada: bool
    fecha_parche: str
    cambios_conocidos: list[CambioConocidoSalida]
    especies: list[ElementoSalida]
    objetos: list[ElementoSalida]
    sin_datos: list[str]

    @classmethod
    def desde(cls, resumen: ResumenDeCatalogo) -> Self:
        return cls(
            formato=resumen.formato,
            version=resumen.version,
            es_ejemplo=resumen.es_ejemplo,
            estimacion_verificada=resumen.estimacion_verificada,
            fecha_parche=resumen.fecha_parche.isoformat(),
            cambios_conocidos=[CambioConocidoSalida.desde(c) for c in resumen.cambios_conocidos],
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
    estimacion_verificada: bool
    fecha_parche: str
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
            estimacion_verificada=calculo.estimacion_verificada,
            fecha_parche=calculo.fecha_parche.isoformat(),
            stats={stat: ValorSugeridoSalida.desde(v) for stat, v in sugerencia.stats.items()},
            cp=ValorSugeridoSalida.desde(sugerencia.cp),
            objetos=[ObjetoSalida.desde(o) for o in sugerencia.objetos],
            sin_datos=list(sugerencia.sin_datos),
        )


class PotencialDeStatSalida(BaseModel):
    potencial: int
    bono_estrella: int
    bono_objeto: int
    n: int
    saltos: int
    proximo_salto: int
    puntos_al_proximo: int
    porcentaje_por_puntos: float
    porcentaje_por_saltos: float
    via_despertar: str

    @classmethod
    def desde(cls, stat: PotencialDeStat) -> Self:
        return cls(
            potencial=stat.potencial,
            bono_estrella=stat.bono_estrella,
            bono_objeto=stat.bono_objeto,
            n=stat.n,
            saltos=stat.saltos,
            proximo_salto=stat.proximo_salto,
            puntos_al_proximo=stat.puntos_al_proximo,
            porcentaje_por_puntos=float(stat.porcentaje_por_puntos),
            porcentaje_por_saltos=float(stat.porcentaje_por_saltos),
            via_despertar=stat.via_despertar.value,
        )


class PotencialEfectivoSalida(BaseModel):
    confianza: str
    por_punto: float
    salto_cada: int
    salto_porcentaje: float
    cuenta_estrella: bool
    cuenta_objeto: bool
    stats: dict[Stat, PotencialDeStatSalida]

    @classmethod
    def desde(cls, potencial: PotencialEfectivo) -> Self:
        return cls(
            confianza=potencial.confianza.value,
            por_punto=float(potencial.por_punto),
            salto_cada=potencial.salto_cada,
            salto_porcentaje=float(potencial.salto_porcentaje),
            cuenta_estrella=potencial.cuenta_estrella,
            cuenta_objeto=potencial.cuenta_objeto,
            stats={stat: PotencialDeStatSalida.desde(v) for stat, v in potencial.stats.items()},
        )


class TramoDeCupoSalida(BaseModel):
    origen: str
    detalle: str
    suma: int

    @classmethod
    def desde(cls, tramo: TramoDeCupo) -> Self:
        return cls(origen=tramo.origen, detalle=tramo.detalle, suma=tramo.suma)


class CupoDeDespertarSalida(BaseModel):
    confianza: str
    cupo_sugerido: int
    desglose: list[TramoDeCupoSalida]
    total_cargado: int
    diferencia: int
    restantes: int

    @classmethod
    def desde(cls, cupo: CupoDeDespertar) -> Self:
        return cls(
            confianza=cupo.confianza.value,
            cupo_sugerido=cupo.cupo_sugerido,
            desglose=[TramoDeCupoSalida.desde(t) for t in cupo.desglose],
            total_cargado=cupo.total_cargado,
            diferencia=cupo.diferencia,
            restantes=cupo.restantes,
        )


class BonoDeLetraSalida(BaseModel):
    stat: Stat | None
    descripcion: str
    porcentaje: float

    @classmethod
    def desde(cls, bono: BonoDeLetra) -> Self:
        return cls(stat=bono.stat, descripcion=bono.descripcion, porcentaje=float(bono.porcentaje))


class SlotDePersonalidadSalida(BaseModel):
    letra: str
    nombre: str | None
    letra_confirmada: bool
    confianza: str | None
    bonos: list[BonoDeLetraSalida]

    @classmethod
    def desde(cls, slot: SlotDePersonalidad) -> Self:
        return cls(
            letra=slot.letra,
            nombre=slot.nombre,
            letra_confirmada=slot.letra_confirmada,
            confianza=None if slot.confianza is None else slot.confianza.value,
            bonos=[BonoDeLetraSalida.desde(b) for b in slot.bonos],
        )


class ObjetoDePotencialSalida(BaseModel):
    aplicado: bool
    nota: str | None

    @classmethod
    def desde(cls, objeto: ResultadoDeObjetoDePotencial) -> Self:
        nota = None if objeto.nota is None else objeto.nota.value
        return cls(aplicado=objeto.aplicado, nota=nota)


class PotencialSalida(BaseModel):
    version: str
    es_ejemplo: bool
    fecha_parche: str
    potencial: PotencialEfectivoSalida | None
    despertar: CupoDeDespertarSalida | None
    personalidad: list[SlotDePersonalidadSalida] | None
    objeto: ObjetoDePotencialSalida | None
    version_desconocida: bool
    avisos: list[CambioConocidoSalida]
    sin_datos: list[str]

    @classmethod
    def desde(cls, calculo: PotencialRealizado) -> Self:
        r = calculo.resultado
        return cls(
            version=calculo.version,
            es_ejemplo=calculo.es_ejemplo,
            fecha_parche=calculo.fecha_parche.isoformat(),
            potencial=None if r.potencial is None else PotencialEfectivoSalida.desde(r.potencial),
            despertar=None if r.despertar is None else CupoDeDespertarSalida.desde(r.despertar),
            personalidad=None
            if r.personalidad is None
            else [SlotDePersonalidadSalida.desde(s) for s in r.personalidad],
            objeto=None if r.objeto is None else ObjetoDePotencialSalida.desde(r.objeto),
            version_desconocida=r.version_desconocida,
            avisos=[CambioConocidoSalida.desde(c) for c in r.avisos],
            sin_datos=list(r.sin_datos),
        )
