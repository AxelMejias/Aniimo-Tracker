from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

MENSAJE_SIN_CONEXION = (
    "No se pudo conectar a la base de datos. "
    "Levantala con: docker compose up -d db (y revisá DATABASE_URL en backend/.env)."
)


def problema_de_base(engine: Engine, config_de_alembic: Config) -> str | None:
    try:
        with engine.connect() as conexion:
            contexto = MigrationContext.configure(conexion)
            actual = contexto.get_current_revision()
            # Alembic exige un contexto activo para importar migraciones que usan op.f().
            with Operations.context(contexto):
                esperada = ScriptDirectory.from_config(config_de_alembic).get_current_head()
    except SQLAlchemyError:
        return MENSAJE_SIN_CONEXION
    if actual == esperada:
        return None
    return (
        "La base de datos no está en la última migración "
        f"(actual: {actual or 'sin migrar'}, esperada: {esperada}). "
        "Corré, desde backend/: alembic upgrade head"
    )
