from enum import StrEnum

TAMANO_MAXIMO = 1_048_576

_FIRMA_PNG = b"\x89PNG\r\n\x1a\n"
_FIRMA_JPEG = b"\xff\xd8\xff"


class TipoDeImagen(StrEnum):
    PNG = "image/png"
    JPEG = "image/jpeg"
    WEBP = "image/webp"


def detectar_tipo(datos: bytes) -> TipoDeImagen | None:
    if datos.startswith(_FIRMA_PNG):
        return TipoDeImagen.PNG
    if datos.startswith(_FIRMA_JPEG):
        return TipoDeImagen.JPEG
    if datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return TipoDeImagen.WEBP
    return None
