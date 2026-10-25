import logging
from typing import Any

import pytest
from alembic.config import Config
from fastapi import FastAPI
from sqlalchemy.engine import Engine

from app.arranque import arrancar
from app.core.config import Settings


class ServidorEspia:
    def __init__(self) -> None:
        self.llamadas: list[tuple[FastAPI, dict[str, Any]]] = []

    def __call__(self, app: FastAPI, **opciones: Any) -> None:  # noqa: ANN401
        self.llamadas.append((app, opciones))


@pytest.mark.parametrize(
    "problema",
    [
        "La base no responde. Levantala con: docker compose up -d db",
        "La base esta en una revision anterior. Corre: alembic upgrade head",
    ],
)
def test_con_un_problema_sale_con_codigo_1_registra_el_error_y_no_sirve(
    test_settings: Settings, caplog: pytest.LogCaptureFixture, problema: str
) -> None:
    servidor = ServidorEspia()
    with caplog.at_level(logging.ERROR, logger="app"):
        codigo = arrancar(
            test_settings, verificar=lambda _engine, _config: problema, servir=servidor
        )
    assert codigo == 1
    assert servidor.llamadas == []
    assert problema in caplog.text


def test_sin_problemas_sirve_en_el_host_y_puerto_configurados(test_settings: Settings) -> None:
    servidor = ServidorEspia()
    codigo = arrancar(test_settings, verificar=lambda _engine, _config: None, servir=servidor)
    assert codigo == 0
    assert len(servidor.llamadas) == 1
    app, opciones = servidor.llamadas[0]
    assert isinstance(app, FastAPI)
    assert opciones == {"host": "127.0.0.1", "port": 8000}


def test_el_chequeo_recibe_un_engine_y_la_configuracion_de_alembic(
    test_settings: Settings,
) -> None:
    recibidos: list[tuple[object, object]] = []

    def verificar(engine: Engine, config: Config) -> None:
        recibidos.append((engine, config))

    arrancar(test_settings, verificar=verificar, servir=ServidorEspia())
    assert isinstance(recibidos[0][0], Engine)
    assert isinstance(recibidos[0][1], Config)
