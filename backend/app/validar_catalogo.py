import sys
from pathlib import Path

from app.infrastructure.catalogo_crecimiento import RUTA_POR_DEFECTO, ErrorDeCatalogo, leer_catalogo


def main(argumentos: list[str]) -> int:
    if len(argumentos) > 1:
        print("Uso: python -m app.validar_catalogo [ruta]")
        return 2
    ruta = Path(argumentos[0]) if argumentos else RUTA_POR_DEFECTO
    resultado = leer_catalogo(ruta)
    if isinstance(resultado, ErrorDeCatalogo):
        for error in resultado.errores:
            print(error)
        return 1
    cp = "CP con datos" if resultado.cp is not None else "CP sin datos"
    ejemplo = " (DATOS DE EJEMPLO)" if resultado.es_ejemplo else ""
    sin_verificar = "" if resultado.estimacion_verificada else " (ESTIMACIÓN SIN VERIFICAR)"
    print(
        f"Catálogo válido: formato {resultado.formato}, versión {resultado.version}, "
        f"parche {resultado.fecha_parche.isoformat()}, {len(resultado.especies)} especies, "
        f"{len(resultado.objetos or ())} objetos, {cp}{ejemplo}{sin_verificar}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
