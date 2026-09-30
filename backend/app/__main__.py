import logging

import uvicorn

from app.core.config import Settings
from app.core.logging import configure_logging, describe_database_url
from app.main import create_app

settings = Settings()
configure_logging(settings.log_level)
logger = logging.getLogger("app")
logger.info("Arrancando backend, base de datos: %s", describe_database_url(settings.database_url))

app = create_app(settings)

if __name__ == "__main__":
    uvicorn.run(app, host=settings.backend_host, port=settings.backend_port)
