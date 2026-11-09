import argparse
import logging
import sys
import threading
from collections.abc import Callable, Sequence
from typing import Any, BinaryIO, Protocol

import uvicorn
from alembic.config import Config
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, make_url

from alembic import command
from app.core.config import Settings
from app.core.logging import configure_logging, describe_database_url
from app.main import create_app
from app.recursos import carpeta_de_recursos
from app.verificar_base import problema_de_base

SEGUNDOS_DE_ESPERA_DE_LA_BASE = 5

logger = logging.getLogger("app")

Verificador = Callable[[Engine, Config], str | None]
Servidor = Callable[..., Any]


class ServidorUvicorn(Protocol):
    should_exit: bool

    def run(self) -> None: ...


CrearServidor = Callable[[FastAPI, str, int], ServidorUvicorn]


def _servidor_de_uvicorn(app: FastAPI, host: str, port: int) -> ServidorUvicorn:
    return uvicorn.Server(uvicorn.Config(app, host=host, port=port))


def _apagar_al_cerrarse(entrada: BinaryIO, servidor: ServidorUvicorn) -> None:
    def esperar() -> None:
        while entrada.read(1):
            pass
        servidor.should_exit = True

    threading.Thread(target=esperar, daemon=True).start()


def _config_de_alembic(database_url: str) -> Config:
    base = carpeta_de_recursos()
    config = Config(str(base / "alembic.ini"))
    config.set_main_option("script_location", str(base / "alembic"))
    config.attributes["sqlalchemy.url"] = database_url
    return config


def arrancar(
    settings: Settings | None = None,
    *,
    verificar: Verificador = problema_de_base,
    servir: Servidor = uvicorn.run,
    con_padre: bool = False,
    entrada: BinaryIO | None = None,
    crear_servidor: CrearServidor = _servidor_de_uvicorn,
) -> int:
    settings = settings or Settings()
    configure_logging(settings.log_level)
    logger.info(
        "Arrancando backend, base de datos: %s", describe_database_url(settings.database_url)
    )

    engine = create_engine(
        settings.database_url, connect_args={"connect_timeout": SEGUNDOS_DE_ESPERA_DE_LA_BASE}
    )
    try:
        problema = verificar(engine, _config_de_alembic(settings.database_url))
    finally:
        engine.dispose()
    if problema is not None:
        logger.error(problema)
        return 1

    app: FastAPI = create_app(settings)
    if con_padre:
        servidor = crear_servidor(app, settings.backend_host, settings.backend_port)
        _apagar_al_cerrarse(entrada or sys.stdin.buffer, servidor)
        servidor.run()
    else:
        servir(app, host=settings.backend_host, port=settings.backend_port)
    return 0


def migrar(settings: Settings) -> int:
    configure_logging(settings.log_level)
    try:
        command.upgrade(_config_de_alembic(settings.database_url), "head")
    except Exception as error:  # noqa: BLE001
        mensaje = str(error)
        contrasena = make_url(settings.database_url).password
        if contrasena:
            mensaje = mensaje.replace(contrasena, "***")
        logger.error("La migración falló: %s", mensaje)
        return 1
    logger.info("Base de datos en la última migración")
    return 0


def principal(argumentos: Sequence[str], *, servir: Servidor = uvicorn.run) -> int:
    parser = argparse.ArgumentParser(prog="aniimo-backend")
    parser.add_argument("subcomando", nargs="?", choices=["migrar"])
    parser.add_argument("--con-padre", action="store_true")
    opciones = parser.parse_args(argumentos)
    settings = Settings()
    if opciones.subcomando == "migrar":
        return migrar(settings)
    return arrancar(settings, servir=servir, con_padre=opciones.con_padre)
