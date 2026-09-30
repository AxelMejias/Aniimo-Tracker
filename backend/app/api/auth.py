import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.dependencias import (
    limitadores,
    servicio_de_auth,
    sesion_actual,
    usuario_actual,
)
from app.api.esquemas_auth import (
    LoginEntrada,
    PerfilSalida,
    RegistroEntrada,
    TokenSalida,
    UsuarioCreado,
)
from app.api.limite_de_intentos import LimitadorDeIntentos, LimitadoresDeAuth
from app.application.auth import ServicioDeAuth
from app.domain.entidades import Sesion, Usuario, normalizar_nombre_usuario
from app.domain.errores import CredencialesInvalidas

logger = logging.getLogger("app.auth")

router = APIRouter(prefix="/auth")

_MENSAJE_LIMITE = "Demasiados intentos, probá más tarde"

Servicio = Annotated[ServicioDeAuth, Depends(servicio_de_auth)]
Limites = Annotated[LimitadoresDeAuth, Depends(limitadores)]


def _cliente(request: Request) -> str:
    return request.client.host if request.client else "desconocido"


def _limite_excedido(clave: str, limitador: LimitadorDeIntentos) -> HTTPException:
    logger.warning("limite de intentos excedido clave=%r", clave)
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=_MENSAJE_LIMITE,
        headers={"Retry-After": str(limitador.reintentar_en(clave))},
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
def registrar(
    entrada: RegistroEntrada, request: Request, servicio: Servicio, limites: Limites
) -> UsuarioCreado:
    cliente = _cliente(request)
    if not limites.registro_por_cliente.intentar(cliente):
        raise _limite_excedido(cliente, limites.registro_por_cliente)
    usuario = servicio.registrar(entrada.nombre_usuario, entrada.contrasena)
    logger.info("registro ok usuario=%r", usuario.nombre_usuario)
    return UsuarioCreado(id=usuario.id, nombre_usuario=usuario.nombre_usuario)


@router.post("/login")
def iniciar_sesion(
    entrada: LoginEntrada,
    request: Request,
    response: Response,
    servicio: Servicio,
    limites: Limites,
) -> TokenSalida:
    cliente = _cliente(request)
    if not limites.login_por_cliente.intentar(cliente):
        raise _limite_excedido(cliente, limites.login_por_cliente)
    nombre = normalizar_nombre_usuario(entrada.nombre_usuario)
    if limites.login_fallido.excedido(nombre):
        raise _limite_excedido(nombre, limites.login_fallido)
    try:
        token, sesion = servicio.iniciar_sesion(nombre, entrada.contrasena)
    except CredencialesInvalidas:
        limites.login_fallido.registrar(nombre)
        logger.warning("login fallido usuario=%r", nombre)
        raise
    limites.login_fallido.reiniciar(nombre)
    logger.info("login ok usuario=%r", nombre)
    response.headers["Cache-Control"] = "no-store"
    return TokenSalida(access_token=token, expira_en=sesion.expira_en)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def cerrar_sesion(
    usuario: Annotated[Usuario, Depends(usuario_actual)],
    sesion: Annotated[tuple[Usuario, Sesion], Depends(sesion_actual)],
    servicio: Servicio,
) -> Response:
    servicio.cerrar_sesion(sesion[1].id)
    logger.info("logout usuario=%r", usuario.nombre_usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
def perfil(usuario: Annotated[Usuario, Depends(usuario_actual)]) -> PerfilSalida:
    return PerfilSalida(nombre_usuario=usuario.nombre_usuario)
