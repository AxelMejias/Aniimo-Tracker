import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy.orm import Session, sessionmaker

from app.application.teams import (
    FichaGuardada,
    ResumenDeTeam,
    ficha_del_team,
    imagen_del_team,
    resumir,
)
from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import (
    Amistad,
    EstadoDeAmistad,
    ImagenAniimo,
    Team,
    Usuario,
    normalizar_nombre_usuario,
)
from app.domain.errores import (
    AmistadExistente,
    AmistadNoEncontrada,
    AutoAmistad,
    TeamNoEncontrado,
    UsuarioNoEncontrado,
)

logger = logging.getLogger("app")


class Relacion(StrEnum):
    NINGUNA = "ninguna"
    SOLICITUD_ENVIADA = "solicitud_enviada"
    SOLICITUD_RECIBIDA = "solicitud_recibida"
    AMIGO = "amigo"


@dataclass(frozen=True, slots=True)
class UsuarioConRelacion:
    usuario: Usuario
    relacion: Relacion


@dataclass(frozen=True, slots=True)
class Amigo:
    usuario: Usuario
    desde: datetime


@dataclass(frozen=True, slots=True)
class Solicitud:
    usuario: Usuario
    creada_en: datetime


@dataclass(frozen=True, slots=True)
class ListaDeAmigos:
    amigos: tuple[Amigo, ...]
    recibidas: tuple[Solicitud, ...]
    enviadas: tuple[Solicitud, ...]


def _relacion(amistad: Amistad | None, usuario_id: UUID) -> Relacion:
    if amistad is None:
        return Relacion.NINGUNA
    if amistad.estado is EstadoDeAmistad.ACEPTADA:
        return Relacion.AMIGO
    if amistad.solicitante_id == usuario_id:
        return Relacion.SOLICITUD_ENVIADA
    return Relacion.SOLICITUD_RECIBIDA


def _amigo_aceptado(uow: UnitOfWork, usuario_id: UUID, otro_id: UUID) -> Usuario:
    if usuario_id == otro_id:
        raise AmistadNoEncontrada
    amistad = uow.amistades.obtener_entre(usuario_id, otro_id)
    if amistad is None or amistad.estado is not EstadoDeAmistad.ACEPTADA:
        raise AmistadNoEncontrada
    amigo = uow.usuarios.obtener(otro_id)
    if amigo is None:
        raise AmistadNoEncontrada
    return amigo


def _team_visible(uow: UnitOfWork, amigo: Usuario, team_id: UUID) -> Team:
    team = uow.teams.obtener_visible_de_usuario(team_id, amigo.id)
    if team is None:
        raise TeamNoEncontrado
    return team


class ServicioDeAmigos:
    def __init__(
        self, session_factory: sessionmaker[Session], reloj: Callable[[], datetime]
    ) -> None:
        self._session_factory = session_factory
        self._reloj = reloj

    def buscar(self, usuario_id: UUID, nombre_usuario: str) -> UsuarioConRelacion | None:
        with UnitOfWork(self._session_factory) as uow:
            encontrado = uow.usuarios.obtener_por_nombre_usuario(
                normalizar_nombre_usuario(nombre_usuario)
            )
            if encontrado is None or encontrado.id == usuario_id:
                return None
            amistad = uow.amistades.obtener_entre(usuario_id, encontrado.id)
            return UsuarioConRelacion(encontrado, _relacion(amistad, usuario_id))

    def listar(self, usuario_id: UUID) -> ListaDeAmigos:
        with UnitOfWork(self._session_factory) as uow:
            amistades = uow.amistades.listar_de(usuario_id)
            ids = [a.otro(usuario_id) for a in amistades]
            por_id = {u.id: u for u in uow.usuarios.listar_por_ids(ids)}
        amigos: list[Amigo] = []
        recibidas: list[Solicitud] = []
        enviadas: list[Solicitud] = []
        for amistad in amistades:
            usuario = por_id[amistad.otro(usuario_id)]
            if amistad.aceptada_en is not None:
                amigos.append(Amigo(usuario, amistad.aceptada_en))
            elif amistad.solicitante_id == usuario_id:
                enviadas.append(Solicitud(usuario, amistad.creada_en))
            else:
                recibidas.append(Solicitud(usuario, amistad.creada_en))
        return ListaDeAmigos(
            amigos=tuple(sorted(amigos, key=lambda x: x.usuario.nombre_usuario)),
            recibidas=tuple(sorted(recibidas, key=lambda x: x.usuario.nombre_usuario)),
            enviadas=tuple(sorted(enviadas, key=lambda x: x.usuario.nombre_usuario)),
        )

    def enviar_solicitud(self, usuario_id: UUID, destinatario_id: UUID) -> UsuarioConRelacion:
        if usuario_id == destinatario_id:
            raise AutoAmistad
        with UnitOfWork(self._session_factory) as uow:
            destinatario = uow.usuarios.obtener(destinatario_id)
            solicitante = uow.usuarios.obtener(usuario_id)
            if destinatario is None or solicitante is None:
                raise UsuarioNoEncontrado
            if uow.amistades.obtener_entre(usuario_id, destinatario_id) is not None:
                raise AmistadExistente
            uow.amistades.agregar(
                Amistad.solicitar(usuario_id, destinatario_id, creada_en=self._reloj())
            )
            uow.commit()
        logger.info(
            "solicitud de amistad enviada: %s -> %s",
            solicitante.nombre_usuario,
            destinatario.nombre_usuario,
        )
        return UsuarioConRelacion(destinatario, Relacion.SOLICITUD_ENVIADA)

    def aceptar(self, usuario_id: UUID, solicitante_id: UUID) -> UsuarioConRelacion:
        with UnitOfWork(self._session_factory) as uow:
            amistad = uow.amistades.obtener_entre(usuario_id, solicitante_id)
            solicitante = uow.usuarios.obtener(solicitante_id)
            if (
                amistad is None
                or solicitante is None
                or amistad.estado is not EstadoDeAmistad.PENDIENTE
                or amistad.solicitante_id != solicitante_id
            ):
                raise AmistadNoEncontrada
            uow.amistades.actualizar(amistad.aceptar(self._reloj()))
            uow.commit()
        logger.info("solicitud de amistad aceptada: %s", solicitante.nombre_usuario)
        return UsuarioConRelacion(solicitante, Relacion.AMIGO)

    def eliminar(self, usuario_id: UUID, otro_id: UUID) -> None:
        with UnitOfWork(self._session_factory) as uow:
            amistad = uow.amistades.obtener_entre(usuario_id, otro_id)
            if amistad is None:
                raise AmistadNoEncontrada
            uow.amistades.borrar(amistad.id)
            uow.commit()
        logger.info("solicitud de amistad o amistad eliminada")

    def teams_de_amigo(
        self, usuario_id: UUID, amigo_id: UUID
    ) -> tuple[Usuario, list[ResumenDeTeam]]:
        with UnitOfWork(self._session_factory) as uow:
            amigo = _amigo_aceptado(uow, usuario_id, amigo_id)
            return amigo, resumir(uow, uow.teams.listar_visibles_de_usuario(amigo.id))

    def ficha_de_amigo(
        self, usuario_id: UUID, amigo_id: UUID, team_id: UUID, slot: int
    ) -> FichaGuardada | None:
        with UnitOfWork(self._session_factory) as uow:
            amigo = _amigo_aceptado(uow, usuario_id, amigo_id)
            return ficha_del_team(uow, _team_visible(uow, amigo, team_id), slot)

    def imagen_de_amigo(
        self, usuario_id: UUID, amigo_id: UUID, team_id: UUID, slot: int
    ) -> ImagenAniimo | None:
        with UnitOfWork(self._session_factory) as uow:
            amigo = _amigo_aceptado(uow, usuario_id, amigo_id)
            return imagen_del_team(uow, _team_visible(uow, amigo, team_id), slot)
