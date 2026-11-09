import re
from pathlib import Path

import pytest

from tests.test_script_levantar import LECTURAS_DE_ARCHIVO

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "empaquetar.ps1"


@pytest.fixture(scope="module")
def texto() -> str:
    assert SCRIPT.exists(), f"Falta {SCRIPT}"
    return SCRIPT.read_text(encoding="utf-8-sig")


def test_nunca_menciona_la_direccion_publica(texto: str) -> None:
    assert "0.0.0.0" not in texto  # noqa: S104


def test_no_lee_ni_imprime_archivos_env(texto: str) -> None:
    assert LECTURAS_DE_ARCHIVO.search(texto) is None


def test_no_instala_dependencias(texto: str) -> None:
    comandos = [linea for linea in texto.splitlines() if re.match(r"\s*(&|npm|pip)\b", linea)]
    assert comandos, "no se encontraron comandos"
    assert not [linea for linea in comandos if re.search(r"\b(install|ci)\b", linea)]


def test_exige_el_entorno_y_sale_con_codigo_1(texto: str) -> None:
    assert r"backend\.venv" in texto
    assert "node_modules" in texto
    assert "exit 1" in texto


def test_empaqueta_el_backend_compila_y_genera_el_instalador(texto: str) -> None:
    assert "PyInstaller" in texto
    assert "aniimo-backend.spec" in texto
    assert "run build" in texto or "'build'" in texto
    assert "electron-builder" in texto
    assert "--win" in texto
    assert "nsis" in texto


def test_nunca_mata_procesos_ni_toca_docker(texto: str) -> None:
    assert "taskkill" not in texto.lower()
    assert "Stop-Process" not in texto
    assert "docker" not in texto.lower()
