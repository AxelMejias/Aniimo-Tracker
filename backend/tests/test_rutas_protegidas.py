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
    ("GET", "/api/teams"),
    ("POST", "/api/teams"),
    ("PATCH", "/api/teams/{team_id}"),
    ("DELETE", "/api/teams/{team_id}"),
    ("GET", "/api/teams/{team_id}/aniimo/{slot}"),
    ("PUT", "/api/teams/{team_id}/aniimo/{slot}"),
    ("DELETE", "/api/teams/{team_id}/aniimo/{slot}"),
    ("GET", "/api/teams/{team_id}/aniimo/{slot}/imagen"),
    ("PUT", "/api/teams/{team_id}/aniimo/{slot}/imagen"),
    ("DELETE", "/api/teams/{team_id}/aniimo/{slot}/imagen"),
    ("PUT", "/api/teams/sueltos/orden"),
    ("POST", "/api/grupos"),
    ("PUT", "/api/grupos/orden"),
    ("PATCH", "/api/grupos/{grupo_id}"),
    ("DELETE", "/api/grupos/{grupo_id}"),
    ("PUT", "/api/grupos/{grupo_id}/orden"),
    ("PUT", "/api/grupos/{grupo_id}/teams/{team_id}"),
    ("DELETE", "/api/grupos/{grupo_id}/teams/{team_id}"),
    ("GET", "/api/usuarios"),
    ("GET", "/api/amigos"),
    ("POST", "/api/amigos/solicitudes"),
    ("POST", "/api/amigos/solicitudes/{usuario_id}/aceptar"),
    ("DELETE", "/api/amigos/{usuario_id}"),
    ("GET", "/api/calculo/catalogo"),
    ("POST", "/api/calculo/stats"),
    ("POST", "/api/calculo/potencial"),
    ("GET", "/api/amigos/{usuario_id}/teams"),
    ("GET", "/api/amigos/{usuario_id}/teams/{team_id}/aniimo/{slot}"),
    ("GET", "/api/amigos/{usuario_id}/teams/{team_id}/aniimo/{slot}/imagen"),
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


def test_todas_las_rutas_de_teams_declaran_usuario_actual(app_api: FastAPI) -> None:
    de_teams = {
        (metodo, path)
        for path, metodos, _ in _rutas(app_api)
        if path.startswith("/api/teams")
        for metodo in metodos
    }
    assert len(de_teams) == 11
    assert de_teams <= _con_usuario_actual(app_api, protegidas=True)


def test_las_rutas_de_amistad_declaran_usuario_actual(app_api: FastAPI) -> None:
    de_amistad = {
        (metodo, path)
        for path, metodos, _ in _rutas(app_api)
        if path.startswith(("/api/usuarios", "/api/amigos"))
        for metodo in metodos
    }
    assert len(de_amistad) == 8
    assert de_amistad <= _con_usuario_actual(app_api, protegidas=True)


def test_las_rutas_de_lectura_de_amigos_son_todas_get(app_api: FastAPI) -> None:
    de_lectura = [
        (path, metodos)
        for path, metodos, _ in _rutas(app_api)
        if path.startswith("/api/amigos/{usuario_id}/teams")
    ]
    assert len(de_lectura) == 3
    assert all(metodos == {"GET"} for _, metodos in de_lectura)


def _declara_sin_cache(dependant: Dependant) -> bool:
    return any(d.call.__name__ == "_sin_cache" for d in dependant.dependencies if d.call)


def test_las_rutas_de_grupos_y_el_orden_de_sueltos_declaran_usuario_actual_y_no_store(
    app_api: FastAPI,
) -> None:
    rutas = [
        (metodo, path, dependant)
        for path, metodos, dependant in _rutas(app_api)
        if path.startswith("/api/grupos") or path == "/api/teams/sueltos/orden"
        for metodo in metodos
    ]
    assert len(rutas) == 8
    assert all(_usa(dependant, usuario_actual) for _, _, dependant in rutas)
    assert all(_declara_sin_cache(dependant) for _, _, dependant in rutas)
