import io
import threading
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi import FastAPI
from pydantic import ValidationError
from sqlalchemy.engine import Engine

from alembic import command
from app.arranque import arrancar, migrar, principal
from app.core.config import Settings
from app.verificar_base import problema_de_base

CONTRASENA = "clave-secreta-de-prueba"


def _revision_actual(engine: Engine) -> str | None:
    with engine.connect() as conexion:
        return MigrationContext.configure(conexion).get_current_revision()


def test_migrar_deja_una_base_vacia_en_la_ultima_revision(
    migrated_engine: Engine, alembic_config: Config, test_database_url: str
) -> None:
    command.downgrade(alembic_config, "base")
    assert _revision_actual(migrated_engine) is None
    try:
        codigo = migrar(Settings(DATABASE_URL=test_database_url, _env_file=None))
        assert codigo == 0
        assert _revision_actual(migrated_engine) is not None
        assert problema_de_base(migrated_engine, alembic_config) is None
    finally:
        command.upgrade(alembic_config, "head")


def test_migrar_sobre_una_base_ya_migrada_sale_con_0(
    migrated_engine: Engine, test_database_url: str
) -> None:
    antes = _revision_actual(migrated_engine)
    assert migrar(Settings(DATABASE_URL=test_database_url, _env_file=None)) == 0
    assert _revision_actual(migrated_engine) == antes


def test_migrar_sin_base_sale_con_1_y_no_filtra_la_contrasena(
    capfd: pytest.CaptureFixture[str],
) -> None:
    settings = Settings(
        DATABASE_URL=f"postgresql+psycopg://aniimo:{CONTRASENA}@127.0.0.1:1/aniimo?connect_timeout=2",
        _env_file=None,
    )
    codigo = migrar(settings)
    salida = capfd.readouterr().err
    assert codigo == 1
    assert "La migración falló" in salida
    assert CONTRASENA not in salida


def test_migrar_con_error_que_menciona_la_contrasena_la_oculta(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def falla(_config: Config, _revision: str) -> None:
        raise RuntimeError(f"no se pudo entrar con {CONTRASENA}")

    monkeypatch.setattr(command, "upgrade", falla)
    settings = Settings(
        DATABASE_URL=f"postgresql+psycopg://aniimo:{CONTRASENA}@127.0.0.1:1/aniimo?connect_timeout=2",
        _env_file=None,
    )
    assert migrar(settings) == 1
    assert CONTRASENA not in caplog.text
    assert "no se pudo entrar" in caplog.text


class ServidorFalso:
    def __init__(self) -> None:
        self.should_exit = False
        self.arranco = threading.Event()
        self.termino = threading.Event()

    def run(self) -> None:
        self.arranco.set()
        while not self.should_exit:
            threading.Event().wait(0.01)
        self.termino.set()


class EntradaControlable(io.RawIOBase):
    def __init__(self) -> None:
        self.cerrada = threading.Event()

    def readable(self) -> bool:
        return True

    def readinto(self, _buffer: bytearray) -> int:
        self.cerrada.wait()
        return 0


def test_con_padre_cerrar_la_entrada_apaga_el_servidor(test_settings: Settings) -> None:
    servidor = ServidorFalso()
    entrada = EntradaControlable()
    hilo = threading.Thread(
        target=arrancar,
        args=(test_settings,),
        kwargs={
            "verificar": lambda _e, _c: None,
            "con_padre": True,
            "entrada": entrada,
            "crear_servidor": lambda _app, _host, _port: servidor,
        },
    )
    hilo.start()
    assert servidor.arranco.wait(5)
    assert not servidor.should_exit
    entrada.cerrada.set()
    assert servidor.termino.wait(5)
    hilo.join(5)
    assert not hilo.is_alive()


def test_con_padre_el_servidor_se_crea_en_el_host_y_puerto_configurados(
    test_settings: Settings,
) -> None:
    recibidos: list[tuple[FastAPI, str, int]] = []
    entrada = io.BytesIO(b"")

    def crear(app: FastAPI, host: str, port: int) -> ServidorFalso:
        recibidos.append((app, host, port))
        servidor = ServidorFalso()
        servidor.should_exit = True
        return servidor

    codigo = arrancar(
        test_settings,
        verificar=lambda _e, _c: None,
        con_padre=True,
        entrada=entrada,
        crear_servidor=crear,
    )
    assert codigo == 0
    assert len(recibidos) == 1
    assert recibidos[0][1:] == ("127.0.0.1", 8000)


def test_sin_la_bandera_no_se_lee_la_entrada(test_settings: Settings) -> None:
    class EntradaProhibida(io.RawIOBase):
        def readable(self) -> bool:
            return True

        def readinto(self, _buffer: bytearray) -> int:
            raise AssertionError("no debía leerse la entrada")

    llamadas: list[object] = []
    codigo = arrancar(
        test_settings,
        verificar=lambda _e, _c: None,
        servir=lambda *a, **k: llamadas.append((a, k)),
        entrada=EntradaProhibida(),
    )
    assert codigo == 0
    assert len(llamadas) == 1


@pytest.mark.parametrize("argumentos", [["migrar"], [], ["--con-padre"]])
def test_host_fuera_de_loopback_se_rechaza_con_y_sin_subcomando(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, argumentos: list[str]
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://u:p@127.0.0.1:1/aniimo?connect_timeout=2"
    )
    monkeypatch.setenv("BACKEND_HOST", "0.0.0.0")  # noqa: S104
    with pytest.raises(ValidationError):
        principal(argumentos)


def test_un_subcomando_desconocido_sale_con_2(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://u:p@127.0.0.1:1/aniimo?connect_timeout=2"
    )
    with pytest.raises(SystemExit) as salida:
        principal(["borrar-todo"])
    assert salida.value.code == 2


def test_principal_con_migrar_no_sirve(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, test_database_url: str, migrated_engine: Engine
) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("DATABASE_URL", test_database_url)
    servido: list[object] = []
    assert principal(["migrar"], servir=lambda *a, **k: servido.append(a)) == 0
    assert servido == []
