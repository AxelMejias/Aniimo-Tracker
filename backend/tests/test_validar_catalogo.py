import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.infrastructure.catalogo_crecimiento import RUTA_POR_DEFECTO
from app.validar_catalogo import main

BACKEND = Path(__file__).resolve().parents[1]


def test_catalogo_valido_de_ejemplo_imprime_el_resumen_y_sale_con_cero(
    capsys: pytest.CaptureFixture[str],
) -> None:
    codigo = main([str(RUTA_POR_DEFECTO)])

    salida = capsys.readouterr().out
    assert codigo == 0
    assert "formato 2" in salida
    assert "ejemplo-2" in salida
    assert "parche 2026-09-23" in salida
    assert "2 especies" in salida
    assert "2 objetos" in salida
    assert "CP con datos" in salida
    assert "DATOS DE EJEMPLO" in salida
    assert "ESTIMACIÓN SIN VERIFICAR" in salida


def test_sin_ruta_valida_el_archivo_por_defecto(capsys: pytest.CaptureFixture[str]) -> None:
    codigo = main([])

    assert codigo == 0
    assert "Catálogo válido" in capsys.readouterr().out


def test_catalogo_real_no_dice_datos_de_ejemplo_y_avisa_si_no_tiene_cp(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    datos = json.loads(RUTA_POR_DEFECTO.read_text(encoding="utf-8"))
    datos["es_ejemplo"] = False
    datos["estimacion_verificada"] = True
    del datos["cp"]
    del datos["objetos"]
    ruta = tmp_path / "real.json"
    ruta.write_text(json.dumps(datos), encoding="utf-8")

    codigo = main([str(ruta)])

    salida = capsys.readouterr().out
    assert codigo == 0
    assert "DATOS DE EJEMPLO" not in salida
    assert "ESTIMACIÓN SIN VERIFICAR" not in salida
    assert "CP sin datos" in salida
    assert "0 objetos" in salida


def test_catalogo_con_errores_imprime_una_linea_por_error_y_sale_con_uno(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    datos = json.loads(RUTA_POR_DEFECTO.read_text(encoding="utf-8"))
    datos["especies"][0]["base"]["atq"][1]["nivel"] = 1
    datos["estrellas"][0]["modificadores"]["atq"][0]["tipo"] = "multiplicar"
    ruta = tmp_path / "roto.json"
    ruta.write_text(json.dumps(datos), encoding="utf-8")

    codigo = main([str(ruta)])

    lineas = [linea for linea in capsys.readouterr().out.splitlines() if linea.strip()]
    assert codigo == 1
    assert any(linea.startswith("especies[0].base.atq[1].nivel: ") for linea in lineas)
    assert any(linea.startswith("estrellas[0].modificadores.atq[0].tipo: ") for linea in lineas)
    assert len(lineas) == 2


def test_catalogo_con_el_formato_anterior_sale_con_uno(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    datos = json.loads(RUTA_POR_DEFECTO.read_text(encoding="utf-8"))
    del datos["formato"]
    ruta = tmp_path / "viejo.json"
    ruta.write_text(json.dumps(datos), encoding="utf-8")

    codigo = main([str(ruta)])

    salida = capsys.readouterr().out
    assert codigo == 1
    assert salida.startswith("formato: ")
    assert "formato anterior" in salida


def test_archivo_inexistente_sale_con_uno(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    codigo = main([str(tmp_path / "no-esta.json")])

    assert codigo == 1
    assert "no se pudo leer" in capsys.readouterr().out


def test_mas_de_un_argumento_es_un_error_de_uso(capsys: pytest.CaptureFixture[str]) -> None:
    codigo = main(["a.json", "b.json"])

    assert codigo == 2
    assert "Uso" in capsys.readouterr().out


def test_se_puede_correr_como_modulo() -> None:
    resultado = subprocess.run(  # noqa: S603
        [sys.executable, "-m", "app.validar_catalogo"],
        cwd=BACKEND,
        capture_output=True,
        text=True,
        check=False,
        env={"PYTHONPATH": str(BACKEND), "SYSTEMROOT": "C:\\Windows", "PYTHONIOENCODING": "utf-8"},
    )

    assert resultado.returncode == 0, resultado.stderr
    assert "DATOS DE EJEMPLO" in resultado.stdout


def test_una_ruta_relativa_se_resuelve_desde_el_directorio_actual(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    (tmp_path / "copia.json").write_text(
        RUTA_POR_DEFECTO.read_text(encoding="utf-8"), encoding="utf-8"
    )
    monkeypatch.chdir(tmp_path)

    codigo = main(["copia.json"])

    assert codigo == 0
    assert "Catálogo válido" in capsys.readouterr().out
