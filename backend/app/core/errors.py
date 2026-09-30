import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("app")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def handle_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Excepción no manejada en %s: %s", request.url.path, exc)
        return JSONResponse(status_code=500, content={"detail": "Error interno del servidor"})
