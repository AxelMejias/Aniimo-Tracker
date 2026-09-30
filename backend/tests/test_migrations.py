from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from alembic import command

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _alembic_config(database_url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["sqlalchemy.url"] = database_url
    return config


def test_alembic_upgrade_head_creates_no_domain_tables(
    test_database_url: str, test_engine: Engine
) -> None:
    config = _alembic_config(test_database_url)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    tables = inspect(test_engine).get_table_names()
    assert tables == ["alembic_version"]
