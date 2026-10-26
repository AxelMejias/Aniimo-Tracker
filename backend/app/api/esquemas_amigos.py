from dataclasses import replace
from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.api.esquemas_teams import (
    FichaBase,
    SlotSalida,
    campos_de_ficha,
)
from app.application.amigos import (
    Amigo,
    ListaDeAmigos,
    Relacion,
    Solicitud,
    UsuarioConRelacion,
)
from app.application.teams import FichaGuardada, ListaDeTeams, ResumenDeGrupo, ResumenDeTeam
from app.domain.entidades import AniimoDelTeam, Usuario

NOMBRE_USUARIO = r"^[A-Za-z0-9_]{3,32}$"


class SolicitudEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    usuario_id: Annotated[UUID, Field(strict=False)]


class UsuarioEncontradoSalida(BaseModel):
    id: UUID
    nombre_usuario: str
    relacion: Relacion

    @classmethod
    def desde(cls, resultado: UsuarioConRelacion) -> Self:
        return cls(
            id=resultado.usuario.id,
            nombre_usuario=resultado.usuario.nombre_usuario,
            relacion=resultado.relacion,
        )


class BusquedaSalida(BaseModel):
    usuario: UsuarioEncontradoSalida | None


class AmigoSalida(BaseModel):
    id: UUID
    nombre_usuario: str
    desde: datetime

    @classmethod
    def desde_amigo(cls, amigo: Amigo) -> Self:
        return cls(
            id=amigo.usuario.id, nombre_usuario=amigo.usuario.nombre_usuario, desde=amigo.desde
        )


class SolicitudSalida(BaseModel):
    id: UUID
    nombre_usuario: str
    creada_en: datetime

    @classmethod
    def desde_solicitud(cls, solicitud: Solicitud) -> Self:
        return cls(
            id=solicitud.usuario.id,
            nombre_usuario=solicitud.usuario.nombre_usuario,
            creada_en=solicitud.creada_en,
        )


class ListaDeAmigosSalida(BaseModel):
    amigos: list[AmigoSalida]
    recibidas: list[SolicitudSalida]
    enviadas: list[SolicitudSalida]

    @classmethod
    def desde(cls, lista: ListaDeAmigos) -> Self:
        return cls(
            amigos=[AmigoSalida.desde_amigo(a) for a in lista.amigos],
            recibidas=[SolicitudSalida.desde_solicitud(s) for s in lista.recibidas],
            enviadas=[SolicitudSalida.desde_solicitud(s) for s in lista.enviadas],
        )


class DuenioSalida(BaseModel):
    id: UUID
    nombre_usuario: str


class TeamDeAmigoSalida(BaseModel):
    id: UUID
    nombre: str
    orden: int
    grupo_id: UUID | None
    portada_slot: int | None
    slots: list[SlotSalida]

    @classmethod
    def desde(cls, resumen: ResumenDeTeam) -> Self:
        team = resumen.team
        return cls(
            id=team.id,
            nombre=team.nombre,
            orden=team.orden,
            grupo_id=team.grupo_id,
            portada_slot=resumen.portada_efectiva_slot,
            slots=[SlotSalida.desde(slot) for slot in resumen.slots],
        )


class GrupoDeAmigoSalida(BaseModel):
    id: UUID
    nombre: str
    orden: int
    team_ids: list[UUID]
    portada_team_id: UUID | None

    @classmethod
    def desde(cls, resumen: ResumenDeGrupo) -> Self:
        grupo = resumen.grupo
        return cls(
            id=grupo.id,
            nombre=grupo.nombre,
            orden=grupo.orden,
            team_ids=list(resumen.team_ids),
            portada_team_id=resumen.portada_efectiva_team_id,
        )


class TeamsDeAmigoSalida(BaseModel):
    usuario: DuenioSalida
    teams: list[TeamDeAmigoSalida]
    grupos: list[GrupoDeAmigoSalida]

    @classmethod
    def desde(cls, amigo: Usuario, lista: ListaDeTeams) -> Self:
        return cls(
            usuario=DuenioSalida(id=amigo.id, nombre_usuario=amigo.nombre_usuario),
            teams=[TeamDeAmigoSalida.desde(r) for r in lista.teams],
            grupos=[GrupoDeAmigoSalida.desde(g) for g in lista.grupos],
        )


def ocultar_notas(aniimo: AniimoDelTeam) -> AniimoDelTeam:
    return replace(
        aniimo,
        notas=None,
        notas_habilidades=None,
        stats={stat: replace(valores, notas=None) for stat, valores in aniimo.stats.items()},
        objetos=tuple(replace(o, efecto_nucleo_notas=None) for o in aniimo.objetos),
    )


class FichaDeAmigoSalida(FichaBase):
    slot: int
    tiene_imagen: bool

    @classmethod
    def desde(cls, guardada: FichaGuardada) -> Self:
        aniimo = guardada.aniimo
        visible = ocultar_notas(aniimo) if aniimo.notas_privadas else aniimo
        return cls(slot=aniimo.slot, tiene_imagen=guardada.tiene_imagen, **campos_de_ficha(visible))


class FichaDeAmigoRespuesta(BaseModel):
    aniimo: FichaDeAmigoSalida | None
