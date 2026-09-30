from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from starlette.concurrency import run_in_threadpool

from app.api.dependencias import servicio_de_teams, usuario_actual
from app.api.esquemas_teams import (
    FichaEntrada,
    FichaRespuesta,
    FichaSalida,
    ListaDeTeamsSalida,
    NombreEntrada,
    TeamSalida,
)
from app.application.teams import ServicioDeTeams
from app.domain.entidades import Usuario
from app.domain.errores import AniimoNoEncontrado
from app.domain.imagenes import TAMANO_MAXIMO, TipoDeImagen


def _sin_cache(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/teams", dependencies=[Depends(_sin_cache)])

Autenticado = Annotated[Usuario, Depends(usuario_actual)]
Servicio = Annotated[ServicioDeTeams, Depends(servicio_de_teams)]
IdDeTeam = Annotated[UUID, Path()]
Slot = Annotated[int, Path(ge=1, le=4)]


@router.get("")
def listar(usuario: Autenticado, servicio: Servicio) -> ListaDeTeamsSalida:
    return ListaDeTeamsSalida(
        teams=[TeamSalida.desde(resumen) for resumen in servicio.listar(usuario.id)]
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def crear(entrada: NombreEntrada, usuario: Autenticado, servicio: Servicio) -> TeamSalida:
    return TeamSalida.desde(servicio.crear(usuario.id, entrada.nombre))


@router.patch("/{team_id}")
def renombrar(
    team_id: IdDeTeam, entrada: NombreEntrada, usuario: Autenticado, servicio: Servicio
) -> TeamSalida:
    return TeamSalida.desde(servicio.renombrar(usuario.id, team_id, entrada.nombre))


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(team_id: IdDeTeam, usuario: Autenticado, servicio: Servicio) -> None:
    servicio.borrar(usuario.id, team_id)


@router.get("/{team_id}/aniimo/{slot}")
def leer_ficha(
    team_id: IdDeTeam, slot: Slot, usuario: Autenticado, servicio: Servicio
) -> FichaRespuesta:
    ficha = servicio.obtener_ficha(usuario.id, team_id, slot)
    return FichaRespuesta(aniimo=None if ficha is None else FichaSalida.desde(ficha))


@router.put("/{team_id}/aniimo/{slot}")
def guardar_ficha(
    team_id: IdDeTeam,
    slot: Slot,
    entrada: FichaEntrada,
    usuario: Autenticado,
    servicio: Servicio,
) -> FichaRespuesta:
    ficha = servicio.guardar_ficha(usuario.id, team_id, slot, entrada.a_datos())
    return FichaRespuesta(aniimo=FichaSalida.desde(ficha))


@router.delete("/{team_id}/aniimo/{slot}", status_code=status.HTTP_204_NO_CONTENT)
def vaciar_slot(team_id: IdDeTeam, slot: Slot, usuario: Autenticado, servicio: Servicio) -> None:
    servicio.vaciar_slot(usuario.id, team_id, slot)


def _tipo_declarado(request: Request) -> TipoDeImagen:
    declarado = request.headers.get("content-type", "").split(";")[0].strip().lower()
    try:
        return TipoDeImagen(declarado)
    except ValueError:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Solo se admiten imágenes PNG, JPEG o WebP"
        ) from None


def _demasiado_grande() -> HTTPException:
    return HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "La imagen supera 1 MiB")


async def _leer_cuerpo(request: Request) -> bytes:
    declarado = request.headers.get("content-length", "")
    if declarado.isdigit() and int(declarado) > TAMANO_MAXIMO:
        raise _demasiado_grande()
    cuerpo = bytearray()
    async for trozo in request.stream():
        cuerpo.extend(trozo)
        if len(cuerpo) > TAMANO_MAXIMO:
            raise _demasiado_grande()
    return bytes(cuerpo)


@router.put("/{team_id}/aniimo/{slot}/imagen", status_code=status.HTTP_204_NO_CONTENT)
async def guardar_imagen(
    team_id: IdDeTeam, slot: Slot, request: Request, usuario: Autenticado, servicio: Servicio
) -> None:
    await run_in_threadpool(servicio.comprobar_aniimo, usuario.id, team_id, slot)
    tipo = _tipo_declarado(request)
    datos = await _leer_cuerpo(request)
    if not datos:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La imagen está vacía")
    await run_in_threadpool(servicio.guardar_imagen, usuario.id, team_id, slot, tipo, datos)


@router.get("/{team_id}/aniimo/{slot}/imagen")
def leer_imagen(
    team_id: IdDeTeam, slot: Slot, usuario: Autenticado, servicio: Servicio
) -> Response:
    imagen = servicio.obtener_imagen(usuario.id, team_id, slot)
    if imagen is None:
        raise AniimoNoEncontrado
    return Response(
        content=imagen.datos,
        media_type=imagen.tipo.value,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"},
    )


@router.delete("/{team_id}/aniimo/{slot}/imagen", status_code=status.HTTP_204_NO_CONTENT)
def borrar_imagen(team_id: IdDeTeam, slot: Slot, usuario: Autenticado, servicio: Servicio) -> None:
    servicio.borrar_imagen(usuario.id, team_id, slot)
