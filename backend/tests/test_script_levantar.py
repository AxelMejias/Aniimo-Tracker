import re
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "levantar.ps1"

LECTURAS_DE_ARCHIVO = re.compile(
    r"(Get-Content|\bgc\b|\bcat\b|\btype\b|Select-String|Import-Csv|ReadAllText|ReadAllLines)"
    r"[^\r\n]*\.env",
    re.IGNORECASE,
)


@pytest.fixture(scope="module")
def texto() -> str:
    assert SCRIPT.exists(), f"Falta {SCRIPT}"
    return SCRIPT.read_text(encoding="utf-8-sig")


def test_el_script_existe_y_acepta_solo_verificar(texto: str) -> None:
    assert re.search(r"param\s*\(", texto, re.IGNORECASE)
    assert "$SoloVerificar" in texto


def test_nunca_menciona_la_direccion_publica(texto: str) -> None:
    assert "0.0.0.0" not in texto  # noqa: S104


def test_solo_usa_loopback_para_hablar_con_el_backend(texto: str) -> None:
    assert "http://127.0.0.1:8000/api/health" in texto
    urls = re.findall(r"https?://[^\s'\"]+", texto)
    assert urls
    assert all(url.startswith("http://127.0.0.1") for url in urls)


def test_no_lee_ni_imprime_archivos_env(texto: str) -> None:
    assert LECTURAS_DE_ARCHIVO.search(texto) is None


def test_el_detector_de_lecturas_de_env_funciona() -> None:
    assert LECTURAS_DE_ARCHIVO.search("Get-Content backend\\.env") is not None
    assert LECTURAS_DE_ARCHIVO.search("cat .env") is not None
    assert LECTURAS_DE_ARCHIVO.search("Test-Path (Join-Path $Raiz '.env')") is None


def test_nunca_mata_procesos_por_nombre_ni_con_taskkill(texto: str) -> None:
    assert "taskkill" not in texto.lower()
    assert not re.search(r"\|\s*Stop-Process", texto, re.IGNORECASE)
    assert not re.search(r"Stop-Process\s+-Name", texto, re.IGNORECASE)


def test_solo_levanta_la_base_de_desarrollo(texto: str) -> None:
    assert "docker compose up -d db" in texto
    assert "db-test" not in texto


def test_corre_las_migraciones_y_arranca_el_backend_y_la_app(texto: str) -> None:
    assert "alembic" in texto
    assert "upgrade" in texto
    assert "head" in texto
    assert "'-m', 'app'" in texto
    assert "npm run dev" in texto or "'run', 'dev'" in texto


def test_detiene_el_backend_en_un_finally(texto: str) -> None:
    assert re.search(r"\bfinally\b", texto, re.IGNORECASE)
