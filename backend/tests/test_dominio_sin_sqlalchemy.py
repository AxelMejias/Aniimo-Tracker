import ast
from pathlib import Path

import pytest

DOMINIO = Path(__file__).resolve().parents[1] / "app" / "domain"
PROHIBIDOS = ("sqlalchemy", "app.infrastructure", "app.application")


def _imports_prohibidos(fuente: str) -> list[str]:
    encontrados: list[str] = []
    for nodo in ast.walk(ast.parse(fuente)):
        if isinstance(nodo, ast.Import):
            nombres = [alias.name for alias in nodo.names]
        elif isinstance(nodo, ast.ImportFrom):
            nombres = [nodo.module or ""]
        else:
            continue
        encontrados.extend(
            n for n in nombres if any(n == p or n.startswith(f"{p}.") for p in PROHIBIDOS)
        )
    return encontrados


def test_ningun_modulo_del_dominio_importa_infraestructura() -> None:
    modulos = sorted(DOMINIO.glob("*.py"))
    assert modulos, "No se encontraron módulos en app/domain"
    violaciones = {m.name: _imports_prohibidos(m.read_text(encoding="utf-8")) for m in modulos}
    assert {k: v for k, v in violaciones.items() if v} == {}


@pytest.mark.parametrize(
    "fuente",
    [
        "import sqlalchemy",
        "from sqlalchemy.orm import Session",
        "from app.infrastructure.database import Base",
        "import app.infrastructure.modelos",
    ],
)
def test_el_detector_encuentra_imports_prohibidos(fuente: str) -> None:
    assert _imports_prohibidos(fuente)


@pytest.mark.parametrize(
    "fuente",
    ["import dataclasses", "from enum import StrEnum", "from app.domain.errores import X"],
)
def test_el_detector_ignora_imports_permitidos(fuente: str) -> None:
    assert _imports_prohibidos(fuente) == []
