import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.domain.errores import (
    AniimoNoEncontrado,
    CredencialesInvalidas,
    ErrorDeValidacion,
    ImagenDemasiadoGrande,
    ImagenInvalida,
    LimiteDeTeamsAlcanzado,
    NombreUsuarioDuplicado,
    PosicionDeTeamOcupada,
    SesionInvalida,
    SlotOcupado,
    TeamNoEncontrado,
    ValorInvalido,
)

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

    @app.exception_handler(TeamNoEncontrado)
    @app.exception_handler(AniimoNoEncontrado)
    async def handle_no_encontrado(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(exc)})

    @app.exception_handler(LimiteDeTeamsAlcanzado)
    async def handle_limite_de_teams(request: Request, exc: LimiteDeTeamsAlcanzado) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Ya tenés el máximo de 4 teams"},
        )

    @app.exception_handler(PosicionDeTeamOcupada)
    @app.exception_handler(SlotOcupado)
    async def handle_conflicto_de_carga(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"detail": "Conflicto al guardar, intentá de nuevo"},
        )

    @app.exception_handler(ImagenInvalida)
    async def handle_imagen_invalida(request: Request, exc: ImagenInvalida) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, content={"detail": str(exc)}
        )

    @app.exception_handler(ImagenDemasiadoGrande)
    async def handle_imagen_grande(request: Request, exc: ImagenDemasiadoGrande) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE, content={"detail": str(exc)}
        )

    @app.exception_handler(ErrorDeValidacion)
    async def handle_error_de_validacion(request: Request, exc: ErrorDeValidacion) -> JSONResponse:
        campo = exc.campo if isinstance(exc, ValorInvalido) else "body"
        error = {"loc": ["body", campo], "msg": str(exc), "type": "valor_invalido"}
        return JSONResponse(status_code=422, content={"detail": [error]})

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
