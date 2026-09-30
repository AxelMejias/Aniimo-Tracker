import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.errores import CredencialesInvalidas, NombreUsuarioDuplicado, SesionInvalida

logger = logging.getLogger("app")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Excepción no manejada en %s: %s", request.url.path, exc)
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})

    @app.exception_handler(SesionInvalida)
    async def handle_sesion_invalida(request: Request, exc: SesionInvalida) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": str(exc)},
            headers={"WWW-Authenticate": "Bearer"},
        )

    @app.exception_handler(CredencialesInvalidas)
    async def handle_credenciales_invalidas(
        request: Request, exc: CredencialesInvalidas
    ) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": str(exc)})

    @app.exception_handler(NombreUsuarioDuplicado)
    async def handle_nombre_duplicado(
        request: Request, exc: NombreUsuarioDuplicado
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "El nombre de usuario no está disponible"},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # El manejador por defecto devuelve el valor enviado ("input"), p. ej. una contraseña.
        errores = [
            {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": errores})
