from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

_ESTRICTO = ConfigDict(extra="forbid", strict=True)


class RegistroEntrada(BaseModel):
    model_config = _ESTRICTO

    nombre_usuario: str = Field(pattern=r"^[A-Za-z0-9_]{3,32}$")
    contrasena: str = Field(min_length=12, max_length=128)


class LoginEntrada(BaseModel):
    model_config = _ESTRICTO

    nombre_usuario: str = Field(min_length=1, max_length=64)
    contrasena: str = Field(min_length=1, max_length=128)


class UsuarioCreado(BaseModel):
    id: UUID
    nombre_usuario: str


class TokenSalida(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105
    expira_en: datetime


class PerfilSalida(BaseModel):
    nombre_usuario: str
