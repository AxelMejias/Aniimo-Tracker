import sys
from pathlib import Path

import pytest

from app.recursos import carpeta_de_recursos

BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_sin_congelar_devuelve_la_carpeta_backend() -> None:
    assert carpeta_de_recursos() == BACKEND_DIR


def test_congelado_devuelve_la_carpeta_del_paquete(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    assert carpeta_de_recursos() == tmp_path


def test_congelado_sin_meipass_vuelve_a_la_carpeta_backend(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.delattr(sys, "_MEIPASS", raising=False)
    assert carpeta_de_recursos() == BACKEND_DIR
