import hashlib
import secrets
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Protocol
from uuid import UUID

from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.core.reloj import ahora_utc
from app.domain.entidades import Sesion, Usuario
from app.domain.errores import CredencialesInvalidas, SesionInvalida


class HasherDeContrasenas(Protocol):
    def hashear(self, contrasena: str) -> str: ...

    def verificar(self, contrasena: str, hash_guardado: str) -> bool: ...

    def necesita_rehash(self, hash_guardado: str) -> bool: ...


def hash_de_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class ServicioDeAuth:
    def __init__(
        self,
        session_factory: sessionmaker[Session],
        hasher: HasherDeContrasenas,
        inactividad: timedelta,
        tope: timedelta,
        reloj: Callable[[], datetime] = ahora_utc,
    ) -> None:
        self._session_factory = session_factory
        self._hasher = hasher
        self._inactividad = inactividad
        self._tope = tope
        self._reloj = reloj
        # Mismos parametros que los hashes reales: el usuario inexistente cuesta lo mismo.
        self._hash_ficticio = hasher.hashear(secrets.token_urlsafe(16))

    def registrar(self, nombre_usuario: str, contrasena: str) -> Usuario:
        usuario = Usuario(nombre_usuario, self._hasher.hashear(contrasena))
        with UnitOfWork(self._session_factory) as uow:
            uow.usuarios.agregar(usuario)
            uow.commit()
        return usuario

    def iniciar_sesion(self, nombre_usuario: str, contrasena: str) -> tuple[str, Sesion]:
        with UnitOfWork(self._session_factory) as uow:
            usuario = uow.usuarios.obtener_por_nombre_usuario(nombre_usuario)
            hash_guardado = usuario.password_hash if usuario else self._hash_ficticio
            correcta = self._hasher.verificar(contrasena, hash_guardado)
            if usuario is None or not correcta:
                raise CredencialesInvalidas
            if self._hasher.necesita_rehash(usuario.password_hash):
                uow.usuarios.actualizar(
                    replace(usuario, password_hash=self._hasher.hashear(contrasena))
                )
            ahora = self._reloj()
            uow.sesiones.borrar_vencidas_de(usuario.id, ahora)
            token = secrets.token_urlsafe(32)
            sesion = Sesion(
                usuario_id=usuario.id,
                token_hash=hash_de_token(token),
                creada_en=ahora,
                expira_en=ahora + self._inactividad,
                vence_en=ahora + self._tope,
            )
            uow.sesiones.agregar(sesion)
            uow.commit()
        return token, sesion

    def autenticar(self, token: str) -> tuple[Usuario, Sesion]:
        with UnitOfWork(self._session_factory) as uow:
            sesion = uow.sesiones.obtener_por_token_hash(hash_de_token(token))
            if sesion is None:
                raise SesionInvalida
            ahora = self._reloj()
            if not sesion.vigente(ahora):
                uow.sesiones.borrar(sesion.id)
                uow.commit()
                raise SesionInvalida
            usuario = uow.usuarios.obtener(sesion.usuario_id)
            if usuario is None:
                raise SesionInvalida
            renovada = sesion.renovada(ahora, self._inactividad)
            uow.sesiones.actualizar(renovada)
            uow.commit()
        return usuario, renovada

    def cerrar_sesion(self, sesion_id: UUID) -> None:
        with UnitOfWork(self._session_factory) as uow:
            uow.sesiones.borrar(sesion_id)
            uow.commit()
