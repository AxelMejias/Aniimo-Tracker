import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

import uvicorn
from alembic.config import Config
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from app.core.config import Settings
from app.core.logging import configure_logging, describe_database_url
from app.main import create_app
from app.verificar_base import problema_de_base

SEGUNDOS_DE_ESPERA_DE_LA_BASE = 5
BACKEND_DIR = Path(__file__).resolve().parents[1]

logger = logging.getLogger("app")

Verificador = Callable[[Engine, Config], str | None]
Servidor = Callable[..., Any]


def _config_de_alembic(database_url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["sqlalchemy.url"] = database_url
    return config


def arrancar(
    settings: Settings | None = None,
    *,
    verificar: Verificador = problema_de_base,
    servir: Servidor = uvicorn.run,
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
    servir(app, host=settings.backend_host, port=settings.backend_port)
    return 0
