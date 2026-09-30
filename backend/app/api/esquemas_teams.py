from dataclasses import asdict
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)

from app.application.teams import DatosDeFicha, FichaGuardada, ResumenDeSlot, ResumenDeTeam
from app.domain.catalogos import Elemento, PosicionObjeto, PotencialInnato, Rareza, Rol, Stat
from app.domain.entidades import AniimoDelTeam, MaterialEstrella, ObjetoTransportado, ValoresDeStat

_ESTRICTO = ConfigDict(extra="forbid", strict=True)

_ENTERO_GRANDE = Field(ge=0, le=9_999_999)
_ENTERO_CHICO = Field(ge=0, le=9_999)


def _blanco_a_none(texto: str | None) -> str | None:
    return None if texto is None or not texto.strip() else texto


Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
TextoDeStat = Annotated[
    Annotated[str, StringConstraints(max_length=500)] | None, AfterValidator(_blanco_a_none)
]
TextoDeObjeto = Annotated[
    Annotated[str, StringConstraints(max_length=1000)] | None, AfterValidator(_blanco_a_none)
]
TextoLibre = Annotated[
    Annotated[str, StringConstraints(max_length=4000)] | None, AfterValidator(_blanco_a_none)
]
Personalidad = Annotated[str, StringConstraints(pattern=r"^[EI][NS][TF][JP]$")] | None
# Los catalogos llegan como texto JSON; el modo estricto del resto del esquema no aplica al enum.
ElementoEntrada = Annotated[Elemento, Field(strict=False)] | None
RolEntrada = Annotated[Rol, Field(strict=False)] | None
PotencialInnatoEntrada = Annotated[PotencialInnato, Field(strict=False)] | None
RarezaEntrada = Annotated[Rareza, Field(strict=False)]
PosicionObjetoEntrada = Annotated[PosicionObjeto, Field(strict=False)]


class NombreEntrada(BaseModel):
    model_config = _ESTRICTO

    nombre: Nombre


class StatFicha(BaseModel):
    model_config = _ESTRICTO

    valor_actual: Annotated[int, _ENTERO_GRANDE]
    potencial: Annotated[int, Field(ge=0, le=20)]
    bono_estrellas_incluido: Annotated[int, _ENTERO_GRANDE]
    notas: TextoDeStat


class StatsFicha(BaseModel):
    model_config = _ESTRICTO

    ps: StatFicha
    atq: StatFicha
    def_fisica: StatFicha
    def_magica: StatFicha
    regen: StatFicha
    quiebre: StatFicha


class MaterialFicha(BaseModel):
    model_config = _ESTRICTO

    posicion: Annotated[int, Field(ge=1, le=3)]
    nombre: Nombre
    tengo: Annotated[int, _ENTERO_GRANDE]
    necesito: Annotated[int, _ENTERO_GRANDE]


class EntrenamientoFicha(BaseModel):
    model_config = _ESTRICTO

    estrella_actual: Annotated[int, Field(ge=0, le=99)]
    nivel_requerido_siguiente_etapa: Annotated[int, Field(ge=1, le=999)] | None
    ganancia_despertar: Annotated[int, _ENTERO_CHICO]
    ganancia_seis_potenciales: Annotated[int, _ENTERO_CHICO]
    despertares_total: Annotated[int, _ENTERO_CHICO]
    despertares_usados: Annotated[int, _ENTERO_CHICO]
    materiales: Annotated[list[MaterialFicha], Field(max_length=3)]

    @field_validator("despertares_usados")
    @classmethod
    def _usados_hasta_el_total(cls, usados: int, info: ValidationInfo) -> int:
        total = info.data.get("despertares_total")
        if total is not None and usados > total:
            raise ValueError("Los despertares usados no pueden superar el total")
        return usados

    @field_validator("materiales")
    @classmethod
    def _posiciones_de_material_unicas(cls, materiales: list[MaterialFicha]) -> list[MaterialFicha]:
        if len({m.posicion for m in materiales}) != len(materiales):
            raise ValueError("Las posiciones de los materiales no pueden repetirse")
        return materiales


class ObjetoFicha(BaseModel):
    model_config = _ESTRICTO

    posicion: PosicionObjetoEntrada
    nombre: Nombre
    rareza: RarezaEntrada
    nivel: Annotated[int, Field(ge=1, le=99)]
    contrato: bool
    efecto_nucleo_notas: TextoDeObjeto


class FichaEntrada(BaseModel):
    model_config = _ESTRICTO

    nombre: Nombre
    elemento: ElementoEntrada
    rol: RolEntrada
    potencial_innato: PotencialInnatoEntrada
    personalidad: Personalidad
    nivel: Annotated[int, Field(ge=1, le=999)]
    cp: Annotated[int, _ENTERO_GRANDE]
    stats: StatsFicha
    entrenamiento: EntrenamientoFicha
    objetos: Annotated[list[ObjetoFicha], Field(max_length=2)]
    notas_habilidades: TextoLibre
    notas: TextoLibre

    @field_validator("objetos")
    @classmethod
    def _posiciones_de_objeto_unicas(cls, objetos: list[ObjetoFicha]) -> list[ObjetoFicha]:
        if len({o.posicion for o in objetos}) != len(objetos):
            raise ValueError("Las posiciones de los objetos no pueden repetirse")
        return objetos

    def a_datos(self) -> DatosDeFicha:
        entrenamiento = self.entrenamiento
        return DatosDeFicha(
            nombre=self.nombre,
            elemento=self.elemento,
            rol=self.rol,
            potencial_innato=self.potencial_innato,
            personalidad=self.personalidad,
            nivel=self.nivel,
            cp=self.cp,
            stats={stat: ValoresDeStat(**getattr(self.stats, stat).model_dump()) for stat in Stat},
            estrella_actual=entrenamiento.estrella_actual,
            nivel_requerido_siguiente_etapa=entrenamiento.nivel_requerido_siguiente_etapa,
            ganancia_despertar=entrenamiento.ganancia_despertar,
            ganancia_seis_potenciales=entrenamiento.ganancia_seis_potenciales,
            despertares_usados=entrenamiento.despertares_usados,
            despertares_total=entrenamiento.despertares_total,
            materiales=tuple(MaterialEstrella(**m.model_dump()) for m in entrenamiento.materiales),
            objetos=tuple(ObjetoTransportado(**o.model_dump()) for o in self.objetos),
            notas_habilidades=self.notas_habilidades,
            notas=self.notas,
        )


class FichaSalida(FichaEntrada):
    slot: int
    tiene_imagen: bool

    @classmethod
    def desde(cls, guardada: FichaGuardada) -> Self:
        aniimo = guardada.aniimo
        return cls(
            slot=aniimo.slot,
            tiene_imagen=guardada.tiene_imagen,
            nombre=aniimo.nombre,
            elemento=aniimo.elemento,
            rol=aniimo.rol,
            potencial_innato=aniimo.potencial_innato,
            personalidad=aniimo.personalidad,
            nivel=aniimo.nivel,
            cp=aniimo.cp,
            stats=StatsFicha(**{stat: StatFicha(**asdict(aniimo.stats[stat])) for stat in Stat}),
            entrenamiento=_entrenamiento_de(aniimo),
            objetos=[ObjetoFicha(**asdict(o)) for o in aniimo.objetos],
            notas_habilidades=aniimo.notas_habilidades,
            notas=aniimo.notas,
        )


def _entrenamiento_de(aniimo: AniimoDelTeam) -> EntrenamientoFicha:
    return EntrenamientoFicha(
        estrella_actual=aniimo.estrella_actual,
        nivel_requerido_siguiente_etapa=aniimo.nivel_requerido_siguiente_etapa,
        ganancia_despertar=aniimo.ganancia_despertar,
        ganancia_seis_potenciales=aniimo.ganancia_seis_potenciales,
        despertares_total=aniimo.despertares_total,
        despertares_usados=aniimo.despertares_usados,
        materiales=[MaterialFicha(**asdict(m)) for m in aniimo.materiales],
    )


class FichaRespuesta(BaseModel):
    aniimo: FichaSalida | None


class ResumenDeAniimoSalida(BaseModel):
    nombre: str
    nivel: int
    cp: int
    personalidad: str | None
    estrella_actual: int
    despertares_usados: int
    despertares_total: int
    tiene_imagen: bool


class SlotSalida(BaseModel):
    slot: int
    aniimo: ResumenDeAniimoSalida | None

    @classmethod
    def desde(cls, resumen: ResumenDeSlot) -> Self:
        aniimo = resumen.aniimo
        return cls(
            slot=resumen.slot,
            aniimo=None
            if aniimo is None
            else ResumenDeAniimoSalida(
                nombre=aniimo.nombre,
                nivel=aniimo.nivel,
                cp=aniimo.cp,
                personalidad=aniimo.personalidad,
                estrella_actual=aniimo.estrella_actual,
                despertares_usados=aniimo.despertares_usados,
                despertares_total=aniimo.despertares_total,
                tiene_imagen=resumen.tiene_imagen,
            ),
        )


class TeamSalida(BaseModel):
    id: UUID
    nombre: str
    orden: int
    slots: list[SlotSalida]

    @classmethod
    def desde(cls, resumen: ResumenDeTeam) -> Self:
        team = resumen.team
        return cls(
            id=team.id,
            nombre=team.nombre,
            orden=team.orden,
            slots=[SlotSalida.desde(slot) for slot in resumen.slots],
        )


class ListaDeTeamsSalida(BaseModel):
    teams: list[TeamSalida]
