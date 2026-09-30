from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import Settings
from app.core.errors import register_error_handlers


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="Aniimo Team Tracker API")
    app.state.settings = settings
    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix="/api")
    return app
