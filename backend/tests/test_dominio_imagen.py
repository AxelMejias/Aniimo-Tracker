from uuid import uuid4

import pytest

from app.domain.entidades import ImagenAniimo
from app.domain.errores import (
    ErrorDeValidacion,
    ImagenDemasiadoGrande,
    ImagenInvalida,
)
from app.domain.imagenes import TAMANO_MAXIMO, TipoDeImagen, detectar_tipo
from tests.imagenes_de_prueba import GIF, HTML, JPEG, PNG, SVG, WAV, WEBP, con_relleno


@pytest.mark.parametrize(
    ("datos", "esperado"),
    [
        (PNG, TipoDeImagen.PNG),
        (JPEG, TipoDeImagen.JPEG),
        (WEBP, TipoDeImagen.WEBP),
        (b"\x89PNG\r\n\x1a\n", TipoDeImagen.PNG),
        (b"\xff\xd8\xff", TipoDeImagen.JPEG),
        (b"RIFF\x00\x00\x00\x00WEBP", TipoDeImagen.WEBP),
    ],
)
def test_detectar_tipo_reconoce_las_firmas_permitidas(datos: bytes, esperado: TipoDeImagen) -> None:
    assert detectar_tipo(datos) is esperado


@pytest.mark.parametrize(
    "datos",
    [GIF, SVG, HTML, WAV, b"", b"\x89PNG", b"\xff\xd8", b"RIFF\x00\x00\x00\x00WEB", b"RIFF"],
    ids=["gif", "svg", "html", "wav", "vacio", "png-corto", "jpeg-corto", "webp-corto", "riff"],
)
def test_detectar_tipo_rechaza_todo_lo_demas(datos: bytes) -> None:
    assert detectar_tipo(datos) is None


def test_los_valores_del_tipo_son_los_content_type() -> None:
    assert {t.value for t in TipoDeImagen} == {"image/png", "image/jpeg", "image/webp"}


def test_imagen_valida_conserva_sus_datos() -> None:
    aniimo_id = uuid4()
    imagen = ImagenAniimo(aniimo_id=aniimo_id, tipo=TipoDeImagen.WEBP, datos=WEBP)
    assert imagen.aniimo_id == aniimo_id
    assert imagen.tipo is TipoDeImagen.WEBP
    assert imagen.datos == WEBP


@pytest.mark.parametrize(
    ("tipo", "datos"),
    [
        (TipoDeImagen.PNG, JPEG),
        (TipoDeImagen.JPEG, WEBP),
        (TipoDeImagen.WEBP, PNG),
        (TipoDeImagen.PNG, HTML),
        (TipoDeImagen.PNG, SVG),
    ],
)
def test_tipo_declarado_distinto_del_detectado_es_imagen_invalida(
    tipo: TipoDeImagen, datos: bytes
) -> None:
    with pytest.raises(ImagenInvalida):
        ImagenAniimo(aniimo_id=uuid4(), tipo=tipo, datos=datos)


def test_imagen_vacia_es_invalida() -> None:
    with pytest.raises(ImagenInvalida):
        ImagenAniimo(aniimo_id=uuid4(), tipo=TipoDeImagen.PNG, datos=b"")


def test_tamano_limite_de_un_mebibyte() -> None:
    assert TAMANO_MAXIMO == 1_048_576
    justo = ImagenAniimo(
        aniimo_id=uuid4(), tipo=TipoDeImagen.PNG, datos=con_relleno(PNG, TAMANO_MAXIMO)
    )
    assert len(justo.datos) == 1_048_576
    with pytest.raises(ImagenDemasiadoGrande):
        ImagenAniimo(
            aniimo_id=uuid4(), tipo=TipoDeImagen.PNG, datos=con_relleno(PNG, TAMANO_MAXIMO + 1)
        )


def test_los_errores_de_imagen_son_de_validacion() -> None:
    assert issubclass(ImagenInvalida, ErrorDeValidacion)
    assert issubclass(ImagenDemasiadoGrande, ErrorDeValidacion)
