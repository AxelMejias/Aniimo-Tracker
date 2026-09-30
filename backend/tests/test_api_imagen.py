import asyncio
from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.domain.imagenes import TAMANO_MAXIMO
from app.infrastructure.modelos import ImagenAniimoModelo
from tests.fabricas import ClienteAutenticado, ficha_de_referencia
from tests.imagenes_de_prueba import GIF, HTML, JPEG, PNG, SVG, WEBP, con_relleno


@pytest.fixture
def team_id(usuario_a: ClienteAutenticado) -> str:
    team_id = str(usuario_a.post("/api/teams", json={"nombre": "Principal"}).json()["id"])
    usuario_a.put(f"/api/teams/{team_id}/aniimo/1", json=ficha_de_referencia())
    return team_id


def _ruta(team_id: str, slot: int = 1) -> str:
    return f"/api/teams/{team_id}/aniimo/{slot}/imagen"


def _subir(
    cliente: ClienteAutenticado, team_id: str, datos: bytes, tipo: str, slot: int = 1
) -> int:
    return cliente.put(
        _ruta(team_id, slot), content=datos, headers={"Content-Type": tipo}
    ).status_code


def _imagenes_guardadas(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as session:
        return session.scalar(select(func.count()).select_from(ImagenAniimoModelo)) or 0


def test_guardar_un_webp_responde_204_y_marca_tiene_imagen(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    respuesta = usuario_a.put(_ruta(team_id), content=WEBP, headers={"Content-Type": "image/webp"})
    assert respuesta.status_code == 204
    assert respuesta.content == b""
    ficha = usuario_a.get(f"/api/teams/{team_id}/aniimo/1").json()["aniimo"]
    assert ficha["tiene_imagen"] is True


def test_reemplazar_la_imagen(usuario_a: ClienteAutenticado, team_id: str) -> None:
    assert _subir(usuario_a, team_id, PNG, "image/png") == 204
    assert _subir(usuario_a, team_id, JPEG, "image/jpeg") == 204
    leida = usuario_a.get(_ruta(team_id))
    assert leida.content == JPEG
    assert leida.headers["content-type"] == "image/jpeg"


@pytest.mark.parametrize("tipo", ["image/png", "image/jpeg", "image/webp"])
def test_leer_devuelve_los_bytes_exactos_con_cabeceras_seguras(
    usuario_a: ClienteAutenticado, team_id: str, tipo: str
) -> None:
    datos = {"image/png": PNG, "image/jpeg": JPEG, "image/webp": WEBP}[tipo]
    _subir(usuario_a, team_id, datos, tipo)
    respuesta = usuario_a.get(_ruta(team_id))
    assert respuesta.status_code == 200
    assert respuesta.content == datos
    assert respuesta.headers["content-type"] == tipo
    assert respuesta.headers["x-content-type-options"] == "nosniff"
    assert respuesta.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    ("datos", "tipo"),
    [
        (SVG, "image/svg+xml"),
        (GIF, "image/gif"),
        (PNG, "text/html"),
        (PNG, "application/octet-stream"),
        (PNG, ""),
    ],
    ids=["svg", "gif", "html_declarado", "octet_stream", "sin_tipo"],
)
def test_tipo_declarado_no_permitido_responde_415_y_no_guarda(
    usuario_a: ClienteAutenticado,
    session_factory: sessionmaker[Session],
    team_id: str,
    datos: bytes,
    tipo: str,
) -> None:
    respuesta = usuario_a.put(_ruta(team_id), content=datos, headers={"Content-Type": tipo})
    assert respuesta.status_code == 415
    assert _imagenes_guardadas(session_factory) == 0


@pytest.mark.parametrize(
    ("datos", "tipo"),
    [
        (HTML, "image/png"),
        (SVG, "image/png"),
        (JPEG, "image/png"),
        (PNG, "image/webp"),
    ],
    ids=["html_como_png", "svg_como_png", "jpeg_como_png", "png_como_webp"],
)
def test_firma_que_no_coincide_responde_415_y_no_guarda(
    usuario_a: ClienteAutenticado,
    session_factory: sessionmaker[Session],
    team_id: str,
    datos: bytes,
    tipo: str,
) -> None:
    assert _subir(usuario_a, team_id, datos, tipo) == 415
    assert _imagenes_guardadas(session_factory) == 0


def test_el_tipo_admite_parametros_y_mayusculas(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    assert _subir(usuario_a, team_id, WEBP, "Image/WebP; charset=binary") == 204


def test_un_mebibyte_exacto_se_acepta(usuario_a: ClienteAutenticado, team_id: str) -> None:
    assert _subir(usuario_a, team_id, con_relleno(PNG, TAMANO_MAXIMO), "image/png") == 204


def test_un_byte_de_mas_responde_413_y_no_guarda(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session], team_id: str
) -> None:
    grande = con_relleno(PNG, TAMANO_MAXIMO + 1)
    assert _subir(usuario_a, team_id, grande, "image/png") == 413
    assert _imagenes_guardadas(session_factory) == 0


def test_content_length_menor_al_real_tambien_responde_413(
    usuario_a: ClienteAutenticado, session_factory: sessionmaker[Session], team_id: str
) -> None:
    grande = con_relleno(PNG, TAMANO_MAXIMO + 1)
    respuesta = usuario_a.put(
        _ruta(team_id),
        content=grande,
        headers={"Content-Type": "image/png", "Content-Length": "100"},
    )
    assert respuesta.status_code == 413
    assert _imagenes_guardadas(session_factory) == 0


def test_content_length_mayor_al_tope_responde_413_sin_leer_el_cuerpo(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    respuesta = usuario_a.put(
        _ruta(team_id),
        content=PNG,
        headers={"Content-Type": "image/png", "Content-Length": str(TAMANO_MAXIMO + 1)},
    )
    assert respuesta.status_code == 413


def test_sin_content_length_se_corta_la_lectura_al_superar_el_tope(
    usuario_a: ClienteAutenticado, app_api: FastAPI, team_id: str
) -> None:
    leidos = 0

    async def cuerpo() -> AsyncIterator[bytes]:
        nonlocal leidos
        yield PNG
        for _ in range(64):
            leidos += 1
            yield b"\x00" * (TAMANO_MAXIMO // 4)

    async def enviar() -> int:
        transporte = ASGITransport(app=app_api)
        async with AsyncClient(transport=transporte, base_url="http://test") as cliente:
            respuesta = await cliente.put(
                _ruta(team_id),
                content=cuerpo(),
                headers={**usuario_a.cabeceras, "Content-Type": "image/png"},
            )
            return respuesta.status_code

    assert asyncio.run(enviar()) == 413
    assert leidos < 64


def test_cuerpo_vacio_responde_422(usuario_a: ClienteAutenticado, team_id: str) -> None:
    assert _subir(usuario_a, team_id, b"", "image/png") == 422


def test_slot_vacio_responde_404_al_guardar(usuario_a: ClienteAutenticado, team_id: str) -> None:
    assert _subir(usuario_a, team_id, WEBP, "image/webp", slot=2) == 404


def test_el_slot_vacio_se_resuelve_antes_que_el_tipo(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    assert _subir(usuario_a, team_id, SVG, "image/svg+xml", slot=2) == 404


def test_leer_un_aniimo_sin_imagen_responde_404(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    respuesta = usuario_a.get(_ruta(team_id))
    assert respuesta.status_code == 404
    assert respuesta.json() == {"detail": "No encontrado"}


def test_leer_de_un_slot_vacio_responde_404(usuario_a: ClienteAutenticado, team_id: str) -> None:
    assert usuario_a.get(_ruta(team_id, 3)).status_code == 404


def test_borrar_la_imagen_no_toca_el_resto_de_la_ficha(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    antes = usuario_a.get(f"/api/teams/{team_id}/aniimo/1").json()["aniimo"]
    _subir(usuario_a, team_id, WEBP, "image/webp")
    respuesta = usuario_a.delete(_ruta(team_id))
    assert respuesta.status_code == 204
    despues = usuario_a.get(f"/api/teams/{team_id}/aniimo/1").json()["aniimo"]
    assert despues["tiene_imagen"] is False
    assert despues == antes
    assert usuario_a.get(_ruta(team_id)).status_code == 404


def test_borrar_una_imagen_inexistente_responde_204(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    assert usuario_a.delete(_ruta(team_id)).status_code == 204


def test_borrar_la_imagen_de_un_slot_vacio_responde_404(
    usuario_a: ClienteAutenticado, team_id: str
) -> None:
    assert usuario_a.delete(_ruta(team_id, 4)).status_code == 404


def test_una_imagen_de_otro_usuario_no_se_pisa(
    usuario_a: ClienteAutenticado, usuario_b: ClienteAutenticado, team_id: str
) -> None:
    _subir(usuario_a, team_id, WEBP, "image/webp")
    assert _subir(usuario_b, team_id, PNG, "image/png") == 404
    assert usuario_a.get(_ruta(team_id)).content == WEBP


def test_sin_token_responde_401(cliente_api: TestClient, team_id: str) -> None:
    respuesta = cliente_api.put(_ruta(team_id), content=PNG, headers={"Content-Type": "image/png"})
    assert respuesta.status_code == 401
    assert cliente_api.get(_ruta(team_id)).status_code == 401
