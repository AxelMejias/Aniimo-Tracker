from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Response, status

from app.api.dependencias import servicio_de_amigos, usuario_actual
from app.api.esquemas_amigos import (
    NOMBRE_USUARIO,
    BusquedaSalida,
    FichaDeAmigoRespuesta,
    FichaDeAmigoSalida,
    ListaDeAmigosSalida,
    SolicitudEntrada,
    TeamsDeAmigoSalida,
    UsuarioEncontradoSalida,
)
from app.application.amigos import ServicioDeAmigos
from app.domain.entidades import Usuario
from app.domain.errores import AniimoNoEncontrado


def _sin_cache(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router_usuarios = APIRouter(prefix="/usuarios", dependencies=[Depends(_sin_cache)])
router_amigos = APIRouter(prefix="/amigos", dependencies=[Depends(_sin_cache)])

Autenticado = Annotated[Usuario, Depends(usuario_actual)]
Servicio = Annotated[ServicioDeAmigos, Depends(servicio_de_amigos)]
IdDeUsuario = Annotated[UUID, Path()]
IdDeTeam = Annotated[UUID, Path()]
Slot = Annotated[int, Path(ge=1, le=4)]
NombreBuscado = Annotated[str, Query(pattern=NOMBRE_USUARIO)]


@router_usuarios.get("")
def buscar(
    nombre_usuario: NombreBuscado, usuario: Autenticado, servicio: Servicio
) -> BusquedaSalida:
    encontrado = servicio.buscar(usuario.id, nombre_usuario)
    return BusquedaSalida(
        usuario=None if encontrado is None else UsuarioEncontradoSalida.desde(encontrado)
    )


@router_amigos.get("")
def listar(usuario: Autenticado, servicio: Servicio) -> ListaDeAmigosSalida:
    return ListaDeAmigosSalida.desde(servicio.listar(usuario.id))


@router_amigos.post("/solicitudes", status_code=status.HTTP_201_CREATED)
def enviar_solicitud(
    entrada: SolicitudEntrada, usuario: Autenticado, servicio: Servicio
) -> UsuarioEncontradoSalida:
    return UsuarioEncontradoSalida.desde(servicio.enviar_solicitud(usuario.id, entrada.usuario_id))


@router_amigos.post("/solicitudes/{usuario_id}/aceptar")
def aceptar_solicitud(
    usuario_id: IdDeUsuario, usuario: Autenticado, servicio: Servicio
) -> UsuarioEncontradoSalida:
    return UsuarioEncontradoSalida.desde(servicio.aceptar(usuario.id, usuario_id))


@router_amigos.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar(usuario_id: IdDeUsuario, usuario: Autenticado, servicio: Servicio) -> None:
    servicio.eliminar(usuario.id, usuario_id)


@router_amigos.get("/{usuario_id}/teams")
def teams_de_amigo(
    usuario_id: IdDeUsuario, usuario: Autenticado, servicio: Servicio
) -> TeamsDeAmigoSalida:
    amigo, resumenes = servicio.teams_de_amigo(usuario.id, usuario_id)
    return TeamsDeAmigoSalida.desde(amigo, resumenes)


@router_amigos.get("/{usuario_id}/teams/{team_id}/aniimo/{slot}")
def ficha_de_amigo(
    usuario_id: IdDeUsuario,
    team_id: IdDeTeam,
    slot: Slot,
    usuario: Autenticado,
    servicio: Servicio,
) -> FichaDeAmigoRespuesta:
    ficha = servicio.ficha_de_amigo(usuario.id, usuario_id, team_id, slot)
    return FichaDeAmigoRespuesta(aniimo=None if ficha is None else FichaDeAmigoSalida.desde(ficha))


@router_amigos.get("/{usuario_id}/teams/{team_id}/aniimo/{slot}/imagen")
def imagen_de_amigo(
    usuario_id: IdDeUsuario,
    team_id: IdDeTeam,
    slot: Slot,
    usuario: Autenticado,
    servicio: Servicio,
) -> Response:
    imagen = servicio.imagen_de_amigo(usuario.id, usuario_id, team_id, slot)
    if imagen is None:
        raise AniimoNoEncontrado
    return Response(
        content=imagen.datos,
        media_type=imagen.tipo.value,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"},
    )
