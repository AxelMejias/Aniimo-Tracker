from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    log_level: str = "INFO"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("cors_origins")
    @classmethod
    def _forbid_wildcard_origin(cls, value: list[str]) -> list[str]:
        if "*" in value:
            raise ValueError("CORS_ORIGINS no puede contener '*'")
        return value

    @field_validator("backend_host")
    @classmethod
    def _require_loopback_host(cls, value: str) -> str:
        if value not in {"127.0.0.1", "localhost"}:
            raise ValueError(
                "BACKEND_HOST solo permite direcciones de loopback (127.0.0.1 o localhost)"
            )
        return value
