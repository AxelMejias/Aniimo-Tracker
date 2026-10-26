from collections.abc import Sequence
from dataclasses import replace
from uuid import UUID

from sqlalchemy.orm import Session, sessionmaker

from app.application.teams import (
    NO_ENVIADO,
    ListaDeTeams,
    NoEnviado,
    lista_de_teams,
)
from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import (
    MAXIMO_DE_GRUPOS,
    MAXIMO_DE_TEAMS_POR_GRUPO,
    GrupoDeTeams,
    Team,
)
from app.domain.errores import (
    GrupoLleno,
    GrupoNoEncontrado,
    LimiteDeGruposAlcanzado,
    PortadaInvalida,
    TeamNoEncontrado,
    ValorInvalido,
)
from app.domain.grupos import repartir_orden

_ORDENES = range(1, MAXIMO_DE_GRUPOS + 1)


def _grupo_del_usuario(uow: UnitOfWork, usuario_id: UUID, grupo_id: UUID) -> GrupoDeTeams:
    grupo = uow.grupos.obtener_de_usuario(grupo_id, usuario_id)
    if grupo is None:
        raise GrupoNoEncontrado
    return grupo


def _team_del_usuario(uow: UnitOfWork, usuario_id: UUID, team_id: UUID) -> Team:
    team = uow.teams.obtener_de_usuario(team_id, usuario_id)
    if team is None:
        raise TeamNoEncontrado
    return team


def _sin_portada_si_era(uow: UnitOfWork, grupo: GrupoDeTeams, team_id: UUID) -> None:
    if grupo.portada_team_id == team_id:
        uow.grupos.actualizar(replace(grupo, portada_team_id=None))


def _reordenar_teams(uow: UnitOfWork, teams: list[Team], pedido: Sequence[UUID]) -> None:
    nuevos = repartir_orden({t.id: t.orden for t in teams}, pedido)
    uow.diferir_unicidad_de_orden()
    for team in teams:
        if nuevos[team.id] != team.orden:
            uow.teams.actualizar(replace(team, orden=nuevos[team.id]))
    uow.commit()


class ServicioDeGrupos:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def crear(self, usuario_id: UUID, nombre: str) -> ListaDeTeams:
        with UnitOfWork(self._session_factory) as uow:
            ocupadas = {g.orden for g in uow.grupos.listar_por_usuario(usuario_id)}
            libres = [orden for orden in _ORDENES if orden not in ocupadas]
            if not libres:
                raise LimiteDeGruposAlcanzado
            uow.grupos.agregar(GrupoDeTeams(usuario_id=usuario_id, nombre=nombre, orden=libres[0]))
            uow.commit()
            return lista_de_teams(uow, usuario_id)

    def editar(
        self,
        usuario_id: UUID,
        grupo_id: UUID,
        *,
        nombre: str | None = None,
        portada_team_id: UUID | None | NoEnviado = NO_ENVIADO,
    ) -> ListaDeTeams:
        if nombre is None and isinstance(portada_team_id, NoEnviado):
            raise ValorInvalido("cambios")
        with UnitOfWork(self._session_factory) as uow:
            grupo = _grupo_del_usuario(uow, usuario_id, grupo_id)
            if nombre is not None:
                grupo = replace(grupo, nombre=nombre)
            if not isinstance(portada_team_id, NoEnviado):
                if portada_team_id is not None:
                    team = uow.teams.obtener_de_usuario(portada_team_id, usuario_id)
                    if team is None or team.grupo_id != grupo.id:
                        raise PortadaInvalida
                grupo = replace(grupo, portada_team_id=portada_team_id)
            uow.grupos.actualizar(grupo)
            uow.commit()
            return lista_de_teams(uow, usuario_id)

    def borrar(self, usuario_id: UUID, grupo_id: UUID) -> None:
        with UnitOfWork(self._session_factory) as uow:
            grupo = _grupo_del_usuario(uow, usuario_id, grupo_id)
            uow.grupos.borrar(grupo.id)
            uow.commit()

    def agregar_team(self, usuario_id: UUID, grupo_id: UUID, team_id: UUID) -> ListaDeTeams:
        with UnitOfWork(self._session_factory) as uow:
            destino = uow.grupos.obtener_de_usuario_con_bloqueo(grupo_id, usuario_id)
            if destino is None:
                raise GrupoNoEncontrado
            team = _team_del_usuario(uow, usuario_id, team_id)
            if team.grupo_id != destino.id:
                if len(uow.teams.listar_por_grupo(destino.id)) >= MAXIMO_DE_TEAMS_POR_GRUPO:
                    raise GrupoLleno
                if team.grupo_id is not None:
                    anterior = _grupo_del_usuario(uow, usuario_id, team.grupo_id)
                    _sin_portada_si_era(uow, anterior, team.id)
                uow.teams.actualizar(replace(team, grupo_id=destino.id))
                uow.commit()
            return lista_de_teams(uow, usuario_id)

    def sacar_team(self, usuario_id: UUID, grupo_id: UUID, team_id: UUID) -> None:
        with UnitOfWork(self._session_factory) as uow:
            grupo = _grupo_del_usuario(uow, usuario_id, grupo_id)
            team = _team_del_usuario(uow, usuario_id, team_id)
            if team.grupo_id != grupo.id:
                raise TeamNoEncontrado
            _sin_portada_si_era(uow, grupo, team.id)
            uow.teams.actualizar(replace(team, grupo_id=None))
            uow.commit()

    def ordenar_grupos(self, usuario_id: UUID, grupo_ids: Sequence[UUID]) -> ListaDeTeams:
        with UnitOfWork(self._session_factory) as uow:
            grupos = uow.grupos.listar_por_usuario_con_bloqueo(usuario_id)
            nuevos = repartir_orden({g.id: g.orden for g in grupos}, grupo_ids)
            uow.diferir_unicidad_de_orden()
            for grupo in grupos:
                if nuevos[grupo.id] != grupo.orden:
                    uow.grupos.actualizar(replace(grupo, orden=nuevos[grupo.id]))
            uow.commit()
            return lista_de_teams(uow, usuario_id)

    def ordenar_teams_del_grupo(
        self, usuario_id: UUID, grupo_id: UUID, team_ids: Sequence[UUID]
    ) -> ListaDeTeams:
        with UnitOfWork(self._session_factory) as uow:
            grupo = uow.grupos.obtener_de_usuario_con_bloqueo(grupo_id, usuario_id)
            if grupo is None:
                raise GrupoNoEncontrado
            _reordenar_teams(uow, uow.teams.listar_por_grupo_con_bloqueo(grupo.id), team_ids)
            return lista_de_teams(uow, usuario_id)

    def ordenar_sueltos(self, usuario_id: UUID, team_ids: Sequence[UUID]) -> ListaDeTeams:
        with UnitOfWork(self._session_factory) as uow:
            _reordenar_teams(uow, uow.teams.listar_sueltos_con_bloqueo(usuario_id), team_ids)
            return lista_de_teams(uow, usuario_id)
