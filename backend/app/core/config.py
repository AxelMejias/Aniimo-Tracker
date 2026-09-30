from typing import Annotated, Self

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    log_level: str = "INFO"
    token_expire_minutes: int = Field(default=30, ge=1, le=1440)
    session_max_hours: int = Field(default=12, ge=1, le=168)

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

    @model_validator(mode="after")
    def _inactivity_within_absolute_cap(self) -> Self:
        if self.token_expire_minutes > self.session_max_hours * 60:
            raise ValueError(
                "TOKEN_EXPIRE_MINUTES (inactividad) no puede superar SESSION_MAX_HOURS"
            )
        return self
