PNG = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 16
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 16
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 16
GIF = b"GIF89a" + b"\x00" * 16
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
HTML = b"<!doctype html><html><body>hola</body></html>"
WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 16


def con_relleno(cabecera: bytes, tamano: int) -> bytes:
    return cabecera + b"\x00" * (tamano - len(cabecera))
