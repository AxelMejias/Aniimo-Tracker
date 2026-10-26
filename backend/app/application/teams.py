from collections.abc import Mapping
from dataclasses import dataclass, replace
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.catalogos import Elemento, PotencialInnato, Rol, Stat
from app.domain.entidades import (
    MAXIMO_DE_TEAMS,
    AniimoDelTeam,
    GrupoDeTeams,
    ImagenAniimo,
    MaterialEstrella,
    ObjetoTransportado,
    Team,
    ValoresDeStat,
)
from app.domain.errores import (
    AniimoNoEncontrado,
    LimiteDeTeamsAlcanzado,
    PortadaInvalida,
    TeamNoEncontrado,
    ValorInvalido,
)
from app.domain.grupos import portada_efectiva_de_grupo, portada_efectiva_de_team
from app.domain.imagenes import TipoDeImagen

_SLOTS = (1, 2, 3, 4)
_ORDENES = range(1, MAXIMO_DE_TEAMS + 1)


class NoEnviado:
    """Distingue un campo que no llegó de uno enviado como null."""


NO_ENVIADO = NoEnviado()


@dataclass(frozen=True, slots=True)
class DatosDeFicha:
    nombre: str
    elemento: Elemento | None
    rol: Rol | None
    potencial_innato: PotencialInnato | None
    personalidad: str | None
    nivel: int
    cp: int
    fecha_parche: date | None
    etapa_estrella: int | None
    stats: Mapping[Stat, ValoresDeStat]
    estrella_actual: int
    nivel_requerido_siguiente_etapa: int | None
    ganancia_despertar: int
    ganancia_seis_potenciales: int
    despertares_usados: int
    despertares_total: int
    materiales: tuple[MaterialEstrella, ...]
    objetos: tuple[ObjetoTransportado, ...]
    notas_habilidades: str | None
    notas: str | None
    notas_privadas: bool


@dataclass(frozen=True, slots=True)
class FichaGuardada:
    aniimo: AniimoDelTeam
    tiene_imagen: bool


@dataclass(frozen=True, slots=True)
class ResumenDeSlot:
    slot: int
    aniimo: AniimoDelTeam | None
    tiene_imagen: bool


@dataclass(frozen=True, slots=True)
class ResumenDeTeam:
    team: Team
    slots: tuple[ResumenDeSlot, ...]
    portada_efectiva_slot: int | None


@dataclass(frozen=True, slots=True)
class ResumenDeGrupo:
    grupo: GrupoDeTeams
    team_ids: tuple[UUID, ...]
    portada_efectiva_team_id: UUID | None


@dataclass(frozen=True, slots=True)
class ListaDeTeams:
    teams: list[ResumenDeTeam]
    grupos: list[ResumenDeGrupo]


def _campos(datos: DatosDeFicha) -> dict[str, Any]:
    return {campo: getattr(datos, campo) for campo in DatosDeFicha.__slots__}


def _team_del_usuario(uow: UnitOfWork, usuario_id: UUID, team_id: UUID) -> Team:
    team = uow.teams.obtener_de_usuario(team_id, usuario_id)
    if team is None:
        raise TeamNoEncontrado
    return team


def _aniimo_del_slot(uow: UnitOfWork, team: Team, slot: int) -> AniimoDelTeam:
    aniimo = uow.aniimos.obtener_por_slot(team.id, slot)
    if aniimo is None:
        raise AniimoNoEncontrado
    return aniimo


def resumir(uow: UnitOfWork, teams: list[Team]) -> list[ResumenDeTeam]:
    aniimos = uow.aniimos.listar_por_teams([t.id for t in teams])
    con_imagen = uow.imagenes.ids_con_imagen([a.id for a in aniimos])
    por_team_y_slot = {(a.team_id, a.slot): a for a in aniimos}
    resumenes: list[ResumenDeTeam] = []
    for team in teams:
        slots = []
        for slot in _SLOTS:
            aniimo = por_team_y_slot.get((team.id, slot))
            slots.append(
                ResumenDeSlot(slot, aniimo, aniimo is not None and aniimo.id in con_imagen)
            )
        ocupados = [s.slot for s in slots if s.aniimo is not None]
        portada = portada_efectiva_de_team(team.portada_slot, ocupados)
        resumenes.append(ResumenDeTeam(team, tuple(slots), portada))
    return resumenes


def resumir_grupos(grupos: list[GrupoDeTeams], teams: list[Team]) -> list[ResumenDeGrupo]:
    resumenes: list[ResumenDeGrupo] = []
    for grupo in grupos:
        team_ids = tuple(
            t.id for t in sorted(teams, key=lambda t: t.orden) if t.grupo_id == grupo.id
        )
        portada = portada_efectiva_de_grupo(grupo.portada_team_id, team_ids)
        resumenes.append(ResumenDeGrupo(grupo, team_ids, portada))
    return resumenes


def lista_de_teams(uow: UnitOfWork, usuario_id: UUID) -> ListaDeTeams:
    teams = uow.teams.listar_por_usuario(usuario_id)
    grupos = uow.grupos.listar_por_usuario(usuario_id)
    return ListaDeTeams(resumir(uow, teams), resumir_grupos(grupos, teams))


def ficha_del_team(uow: UnitOfWork, team: Team, slot: int) -> FichaGuardada | None:
    aniimo = uow.aniimos.obtener_por_slot(team.id, slot)
    if aniimo is None:
        return None
    return FichaGuardada(aniimo, bool(uow.imagenes.ids_con_imagen([aniimo.id])))


def imagen_del_team(uow: UnitOfWork, team: Team, slot: int) -> ImagenAniimo | None:
    aniimo = uow.aniimos.obtener_por_slot(team.id, slot)
    return None if aniimo is None else uow.imagenes.obtener(aniimo.id)


class ServicioDeTeams:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def listar(self, usuario_id: UUID) -> list[ResumenDeTeam]:
        with UnitOfWork(self._session_factory) as uow:
            return resumir(uow, uow.teams.listar_por_usuario(usuario_id))

    def listar_con_grupos(self, usuario_id: UUID) -> ListaDeTeams:
        with UnitOfWork(self._session_factory) as uow:
            return lista_de_teams(uow, usuario_id)

    def crear(self, usuario_id: UUID, nombre: str) -> ResumenDeTeam:
        with UnitOfWork(self._session_factory) as uow:
            ocupadas = {t.orden for t in uow.teams.listar_por_usuario(usuario_id)}
            libres = [orden for orden in _ORDENES if orden not in ocupadas]
            if not libres:
                raise LimiteDeTeamsAlcanzado
            team = Team(usuario_id=usuario_id, nombre=nombre, orden=libres[0])
            uow.teams.agregar(team)
            uow.commit()
            return resumir(uow, [team])[0]

    def editar(
        self,
        usuario_id: UUID,
        team_id: UUID,
        *,
        nombre: str | None = None,
        oculto_para_amigos: bool | None = None,
        portada_slot: int | None | NoEnviado = NO_ENVIADO,
    ) -> ResumenDeTeam:
        if nombre is None and oculto_para_amigos is None and isinstance(portada_slot, NoEnviado):
            raise ValorInvalido("cambios")
        with UnitOfWork(self._session_factory) as uow:
            team = _team_del_usuario(uow, usuario_id, team_id)
            if nombre is not None:
                team = replace(team, nombre=nombre)
            if oculto_para_amigos is not None:
                team = replace(team, oculto_para_amigos=oculto_para_amigos)
            if not isinstance(portada_slot, NoEnviado):
                if (
                    portada_slot is not None
                    and uow.aniimos.obtener_por_slot(team.id, portada_slot) is None
                ):
                    raise PortadaInvalida
                team = replace(team, portada_slot=portada_slot)
            uow.teams.actualizar(team)
            uow.commit()
            return resumir(uow, [team])[0]

    def borrar(self, usuario_id: UUID, team_id: UUID) -> None:
        with UnitOfWork(self._session_factory) as uow:
            team = _team_del_usuario(uow, usuario_id, team_id)
            uow.teams.borrar(team.id)
            uow.commit()

    def obtener_ficha(self, usuario_id: UUID, team_id: UUID, slot: int) -> FichaGuardada | None:
        with UnitOfWork(self._session_factory) as uow:
            return ficha_del_team(uow, _team_del_usuario(uow, usuario_id, team_id), slot)

    def guardar_ficha(
        self, usuario_id: UUID, team_id: UUID, slot: int, datos: DatosDeFicha
    ) -> FichaGuardada:
        with UnitOfWork(self._session_factory) as uow:
            team = _team_del_usuario(uow, usuario_id, team_id)
            existente = uow.aniimos.obtener_por_slot(team.id, slot)
            if existente is None:
                aniimo = AniimoDelTeam(team_id=team.id, slot=slot, **_campos(datos))
                uow.aniimos.agregar(aniimo)
            else:
                aniimo = replace(existente, **_campos(datos))
                uow.aniimos.actualizar(aniimo)
            uow.commit()
            return FichaGuardada(aniimo, bool(uow.imagenes.ids_con_imagen([aniimo.id])))

    def vaciar_slot(self, usuario_id: UUID, team_id: UUID, slot: int) -> None:
        with UnitOfWork(self._session_factory) as uow:
            team = _team_del_usuario(uow, usuario_id, team_id)
            aniimo = uow.aniimos.obtener_por_slot(team.id, slot)
            if aniimo is not None:
                if team.portada_slot == slot:
                    uow.teams.actualizar(replace(team, portada_slot=None))
                uow.aniimos.borrar(aniimo.id)
                uow.commit()

    def comprobar_aniimo(self, usuario_id: UUID, team_id: UUID, slot: int) -> None:
        with UnitOfWork(self._session_factory) as uow:
            _aniimo_del_slot(uow, _team_del_usuario(uow, usuario_id, team_id), slot)

    def guardar_imagen(
        self, usuario_id: UUID, team_id: UUID, slot: int, tipo: TipoDeImagen, datos: bytes
    ) -> None:
        with UnitOfWork(self._session_factory) as uow:
            aniimo = _aniimo_del_slot(uow, _team_del_usuario(uow, usuario_id, team_id), slot)
            uow.imagenes.guardar(ImagenAniimo(aniimo.id, tipo, datos))
            uow.commit()

    def obtener_imagen(self, usuario_id: UUID, team_id: UUID, slot: int) -> ImagenAniimo | None:
        with UnitOfWork(self._session_factory) as uow:
            aniimo = _aniimo_del_slot(uow, _team_del_usuario(uow, usuario_id, team_id), slot)
            return uow.imagenes.obtener(aniimo.id)

    def borrar_imagen(self, usuario_id: UUID, team_id: UUID, slot: int) -> None:
        with UnitOfWork(self._session_factory) as uow:
            aniimo = _aniimo_del_slot(uow, _team_del_usuario(uow, usuario_id, team_id), slot)
            uow.imagenes.borrar(aniimo.id)
            uow.commit()
