import re
from datetime import date
from typing import Annotated

from pydantic import AfterValidator, StringConstraints

from app.domain.entidades import FECHA_DE_PARCHE_MAXIMA, FECHA_DE_PARCHE_MINIMA

_PATRON = r"^\d{4}-\d{2}-\d{2}$"


def a_fecha(valor: str) -> date:
    if re.fullmatch(_PATRON, valor) is None:
        raise ValueError("La fecha debe tener el formato AAAA-MM-DD")
    try:
        fecha = date.fromisoformat(valor)
    except ValueError:
        raise ValueError("La fecha no es válida") from None
    if not FECHA_DE_PARCHE_MINIMA <= fecha <= FECHA_DE_PARCHE_MAXIMA:
        raise ValueError("La fecha está fuera del rango permitido")
    return fecha


def _validar(valor: str) -> str:
    a_fecha(valor)
    return valor


FechaDeParche = Annotated[str, StringConstraints(max_length=10), AfterValidator(_validar)]
