from typing import Annotated, Self
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.api.esquemas_teams import Nombre
from app.domain.entidades import MAXIMO_DE_GRUPOS, MAXIMO_DE_TEAMS, MAXIMO_DE_TEAMS_POR_GRUPO

_ESTRICTO = ConfigDict(extra="forbid", strict=True)

IdDeEntrada = Annotated[UUID, Field(strict=False)]


def _sin_repetidos(ids: list[UUID]) -> list[UUID]:
    if len(set(ids)) != len(ids):
        raise ValueError("La lista no puede repetir ids")
    return ids


def _ids_hasta(maximo: int) -> tuple[object, ...]:
    return Field(min_length=1, max_length=maximo), AfterValidator(_sin_repetidos)


IdsDeGrupos = Annotated[list[IdDeEntrada], *_ids_hasta(MAXIMO_DE_GRUPOS)]
IdsDeTeamsDeGrupo = Annotated[list[IdDeEntrada], *_ids_hasta(MAXIMO_DE_TEAMS_POR_GRUPO)]
IdsDeTeamsSueltos = Annotated[list[IdDeEntrada], *_ids_hasta(MAXIMO_DE_TEAMS)]


class EdicionDeGrupoEntrada(BaseModel):
    model_config = _ESTRICTO

    nombre: Nombre | None = None
    portada_team_id: IdDeEntrada | None = None

    @model_validator(mode="after")
    def _al_menos_uno_y_nombre_no_nulo(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("Se debe enviar al menos un campo")
        if "nombre" in self.model_fields_set and self.nombre is None:
            raise ValueError("El nombre no puede ser nulo")
        return self


class OrdenDeGruposEntrada(BaseModel):
    model_config = _ESTRICTO

    grupo_ids: IdsDeGrupos


class OrdenDeTeamsDeGrupoEntrada(BaseModel):
    model_config = _ESTRICTO

    team_ids: IdsDeTeamsDeGrupo


class OrdenDeSueltosEntrada(BaseModel):
    model_config = _ESTRICTO

    team_ids: IdsDeTeamsSueltos
