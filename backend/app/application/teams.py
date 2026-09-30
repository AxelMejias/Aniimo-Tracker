from collections.abc import Mapping
from dataclasses import dataclass, replace
from uuid import UUID

from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.catalogos import Elemento, PotencialInnato, Rol, Stat
from app.domain.entidades import (
    AniimoDelTeam,
    ImagenAniimo,
    MaterialEstrella,
    ObjetoTransportado,
    Team,
    ValoresDeStat,
)
from app.domain.errores import AniimoNoEncontrado, LimiteDeTeamsAlcanzado, TeamNoEncontrado
from app.domain.imagenes import TipoDeImagen

_SLOTS = (1, 2, 3, 4)
_ORDENES = (1, 2, 3, 4)


@dataclass(frozen=True, slots=True)
class DatosDeFicha:
    nombre: str
    elemento: Elemento | None
    rol: Rol | None
    potencial_innato: PotencialInnato | None
    personalidad: str | None
    nivel: int
    cp: int
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


def _campos(datos: DatosDeFicha) -> dict[str, object]:
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


def _resumir(uow: UnitOfWork, teams: list[Team]) -> list[ResumenDeTeam]:
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
        resumenes.append(ResumenDeTeam(team, tuple(slots)))
    return resumenes


class ServicioDeTeams:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def listar(self, usuario_id: UUID) -> list[ResumenDeTeam]:
        with UnitOfWork(self._session_factory) as uow:
            return _resumir(uow, uow.teams.listar_por_usuario(usuario_id))

    def crear(self, usuario_id: UUID, nombre: str) -> ResumenDeTeam:
        with UnitOfWork(self._session_factory) as uow:
            ocupadas = {t.orden for t in uow.teams.listar_por_usuario(usuario_id)}
            libres = [orden for orden in _ORDENES if orden not in ocupadas]
            if not libres:
                raise LimiteDeTeamsAlcanzado
            team = Team(usuario_id=usuario_id, nombre=nombre, orden=libres[0])
            uow.teams.agregar(team)
            uow.commit()
            return _resumir(uow, [team])[0]

    def renombrar(self, usuario_id: UUID, team_id: UUID, nombre: str) -> ResumenDeTeam:
        with UnitOfWork(self._session_factory) as uow:
            team = replace(_team_del_usuario(uow, usuario_id, team_id), nombre=nombre)
            uow.teams.actualizar(team)
            uow.commit()
            return _resumir(uow, [team])[0]

    def borrar(self, usuario_id: UUID, team_id: UUID) -> None:
        with UnitOfWork(self._session_factory) as uow:
            team = _team_del_usuario(uow, usuario_id, team_id)
            uow.teams.borrar(team.id)
            uow.commit()

    def obtener_ficha(self, usuario_id: UUID, team_id: UUID, slot: int) -> FichaGuardada | None:
        with UnitOfWork(self._session_factory) as uow:
            team = _team_del_usuario(uow, usuario_id, team_id)
            aniimo = uow.aniimos.obtener_por_slot(team.id, slot)
            if aniimo is None:
                return None
            return FichaGuardada(aniimo, bool(uow.imagenes.ids_con_imagen([aniimo.id])))

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
