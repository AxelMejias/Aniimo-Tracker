from typing import Annotated

from fastapi import APIRouter, Depends, Response

from app.api.dependencias import servicio_de_calculo, usuario_actual
from app.api.esquemas_calculo import CalculoEntrada, CalculoSalida, CatalogoSalida
from app.application.calculo import ServicioDeCalculo
from app.domain.entidades import Usuario


def _sin_cache(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/calculo", dependencies=[Depends(_sin_cache)])

Autenticado = Annotated[Usuario, Depends(usuario_actual)]
Servicio = Annotated[ServicioDeCalculo, Depends(servicio_de_calculo)]


@router.get("/catalogo")
def obtener_catalogo(usuario: Autenticado, servicio: Servicio) -> CatalogoSalida:
    return CatalogoSalida.desde(servicio.resumen())


@router.post("/stats")
def calcular(entrada: CalculoEntrada, usuario: Autenticado, servicio: Servicio) -> CalculoSalida:
    return CalculoSalida.desde(servicio.calcular(entrada.a_dominio()))
