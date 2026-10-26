from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Response, status

from app.api.dependencias import servicio_de_grupos, usuario_actual
from app.api.esquemas_grupos import (
    EdicionDeGrupoEntrada,
    OrdenDeGruposEntrada,
    OrdenDeTeamsDeGrupoEntrada,
)
from app.api.esquemas_teams import ListaDeTeamsSalida, NombreEntrada
from app.application.grupos import ServicioDeGrupos
from app.application.teams import NO_ENVIADO
from app.domain.entidades import Usuario


def _sin_cache(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/grupos", dependencies=[Depends(_sin_cache)])

Autenticado = Annotated[Usuario, Depends(usuario_actual)]
Servicio = Annotated[ServicioDeGrupos, Depends(servicio_de_grupos)]
IdDeGrupo = Annotated[UUID, Path()]
IdDeTeam = Annotated[UUID, Path()]


@router.post("", status_code=status.HTTP_201_CREATED)
def crear(entrada: NombreEntrada, usuario: Autenticado, servicio: Servicio) -> ListaDeTeamsSalida:
    return ListaDeTeamsSalida.desde(servicio.crear(usuario.id, entrada.nombre))


@router.put("/orden")
def ordenar(
    entrada: OrdenDeGruposEntrada, usuario: Autenticado, servicio: Servicio
) -> ListaDeTeamsSalida:
    return ListaDeTeamsSalida.desde(servicio.ordenar_grupos(usuario.id, entrada.grupo_ids))


@router.patch("/{grupo_id}")
def editar(
    grupo_id: IdDeGrupo, entrada: EdicionDeGrupoEntrada, usuario: Autenticado, servicio: Servicio
) -> ListaDeTeamsSalida:
    portada = (
        entrada.portada_team_id if "portada_team_id" in entrada.model_fields_set else NO_ENVIADO
    )
    return ListaDeTeamsSalida.desde(
        servicio.editar(usuario.id, grupo_id, nombre=entrada.nombre, portada_team_id=portada)
    )


@router.delete("/{grupo_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(grupo_id: IdDeGrupo, usuario: Autenticado, servicio: Servicio) -> None:
    servicio.borrar(usuario.id, grupo_id)


@router.put("/{grupo_id}/orden")
def ordenar_teams(
    grupo_id: IdDeGrupo,
    entrada: OrdenDeTeamsDeGrupoEntrada,
    usuario: Autenticado,
    servicio: Servicio,
) -> ListaDeTeamsSalida:
    return ListaDeTeamsSalida.desde(
        servicio.ordenar_teams_del_grupo(usuario.id, grupo_id, entrada.team_ids)
    )


@router.put("/{grupo_id}/teams/{team_id}")
def agregar_team(
    grupo_id: IdDeGrupo, team_id: IdDeTeam, usuario: Autenticado, servicio: Servicio
) -> ListaDeTeamsSalida:
    return ListaDeTeamsSalida.desde(servicio.agregar_team(usuario.id, grupo_id, team_id))


@router.delete("/{grupo_id}/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def sacar_team(
    grupo_id: IdDeGrupo, team_id: IdDeTeam, usuario: Autenticado, servicio: Servicio
) -> None:
    servicio.sacar_team(usuario.id, grupo_id, team_id)
