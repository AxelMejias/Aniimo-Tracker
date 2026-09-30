from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.limite_de_intentos import LimitadoresDeAuth
from app.application.auth import ServicioDeAuth
from app.application.teams import ServicioDeTeams
from app.domain.entidades import Sesion, Usuario
from app.domain.errores import SesionInvalida

_bearer = HTTPBearer(auto_error=False)


def servicio_de_auth(request: Request) -> ServicioDeAuth:
    servicio: ServicioDeAuth = request.app.state.servicio_de_auth
    return servicio


def servicio_de_teams(request: Request) -> ServicioDeTeams:
    servicio: ServicioDeTeams = request.app.state.servicio_de_teams
    return servicio


def limitadores(request: Request) -> LimitadoresDeAuth:
    limites: LimitadoresDeAuth = request.app.state.limitadores
    return limites


def sesion_actual(
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    servicio: Annotated[ServicioDeAuth, Depends(servicio_de_auth)],
) -> tuple[Usuario, Sesion]:
    if credenciales is None:
        raise SesionInvalida
    return servicio.autenticar(credenciales.credentials)


def usuario_actual(sesion: Annotated[tuple[Usuario, Sesion], Depends(sesion_actual)]) -> Usuario:
    return sesion[0]
