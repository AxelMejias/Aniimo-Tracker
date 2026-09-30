import logging
from urllib.parse import urlsplit

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def describe_database_url(database_url: str) -> str:
    parts = urlsplit(database_url)
    host = parts.hostname or ""
    netloc = host if parts.port is None else f"{host}:{parts.port}"
    return f"{netloc}{parts.path}"


def configure_logging(log_level: str) -> None:
    logging.basicConfig(level=log_level, format=LOG_FORMAT)
    logging.getLogger("app").setLevel(log_level)
