from collections.abc import Callable
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, sessionmaker

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.limite_de_intentos import crear_limitadores
from app.api.teams import router as teams_router
from app.application.auth import HasherDeContrasenas, ServicioDeAuth
from app.application.teams import ServicioDeTeams
from app.core.config import Settings
from app.core.errors import register_error_handlers
from app.core.reloj import ahora_utc
from app.infrastructure.contrasenas import HasherArgon2
from app.infrastructure.database import make_engine, make_session_factory


def create_app(
    settings: Settings,
    *,
    session_factory: sessionmaker[Session] | None = None,
    hasher: HasherDeContrasenas | None = None,
    reloj: Callable[[], datetime] = ahora_utc,
) -> FastAPI:
    app = FastAPI(title="Aniimo Team Tracker API")
    app.state.settings = settings
    app.state.session_factory = session_factory or make_session_factory(
        make_engine(settings.database_url)
    )
    app.state.servicio_de_auth = ServicioDeAuth(
        app.state.session_factory,
        hasher or HasherArgon2(),
        inactividad=timedelta(minutes=settings.token_expire_minutes),
        tope=timedelta(hours=settings.session_max_hours),
        reloj=reloj,
    )
    app.state.servicio_de_teams = ServicioDeTeams(app.state.session_factory)
    app.state.limitadores = crear_limitadores(reloj)
    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(teams_router, prefix="/api")
    return app
