from collections.abc import Iterator

from fastapi import FastAPI
from fastapi.dependencies.models import Dependant
from fastapi.routing import APIRoute

from app.api.dependencias import usuario_actual

PUBLICAS = {
    ("POST", "/api/auth/register"),
    ("POST", "/api/auth/login"),
    ("GET", "/api/health"),
}
PROTEGIDAS = {
    ("POST", "/api/auth/logout"),
    ("GET", "/api/auth/me"),
}


def _usa(dependant: Dependant, llamada: object) -> bool:
    return any(d.call is llamada or _usa(d, llamada) for d in dependant.dependencies)


def _rutas(app: FastAPI) -> Iterator[tuple[str, set[str], Dependant]]:
    # Los routers incluidos aparecen como contenedores; sus rutas efectivas llevan el prefijo final.
    for ruta in app.routes:
        if isinstance(ruta, APIRoute):
            yield ruta.path, set(ruta.methods), ruta.dependant
        elif hasattr(ruta, "effective_route_contexts"):
            for contexto in ruta.effective_route_contexts():
                yield contexto.path, set(contexto.methods), contexto.dependant


def _con_usuario_actual(app: FastAPI, *, protegidas: bool) -> set[tuple[str, str]]:
    return {
        (metodo, path)
        for path, metodos, dependant in _rutas(app)
        if _usa(dependant, usuario_actual) == protegidas
        for metodo in metodos
    }


def test_las_rutas_sin_usuario_actual_son_exactamente_las_publicas(app_api: FastAPI) -> None:
    assert _con_usuario_actual(app_api, protegidas=False) == PUBLICAS


def test_las_rutas_con_usuario_actual_son_las_protegidas(app_api: FastAPI) -> None:
    assert _con_usuario_actual(app_api, protegidas=True) == PROTEGIDAS


def test_una_ruta_nueva_sin_dependencia_es_detectada(app_api: FastAPI) -> None:
    @app_api.get("/api/olvidada")
    def olvidada() -> dict[str, str]:
        return {}

    desprotegidas = _con_usuario_actual(app_api, protegidas=False) - PUBLICAS
    assert desprotegidas == {("GET", "/api/olvidada")}
