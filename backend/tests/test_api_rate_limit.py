from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from tests.fabricas import CLAVE, HasherEspia, RelojFalso, iniciar_sesion, registrar

MENSAJE = {"detail": "Demasiados intentos, probá más tarde"}
MAL = "clave-incorrecta-larga"


def _fallar(cliente: TestClient, veces: int, nombre: str = "axel") -> None:
    for _ in range(veces):
        assert iniciar_sesion(cliente, nombre, MAL).status_code == 401


def test_cinco_fallos_y_un_sexto_correcto_responden_429(cliente_api: TestClient) -> None:
    registrar(cliente_api)
    _fallar(cliente_api, 5)
    respuesta = iniciar_sesion(cliente_api)
    assert respuesta.status_code == 429
    assert respuesta.json() == MENSAJE
    assert int(respuesta.headers["retry-after"]) > 0


def test_el_bloqueo_no_crea_sesion(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    registrar(cliente_api)
    _fallar(cliente_api, 5)
    iniciar_sesion(cliente_api)
    with session_factory() as session:
        assert session.execute(text("SELECT count(*) FROM sesion")).scalar_one() == 0


def test_retry_after_es_el_tiempo_restante_de_la_ventana(
    cliente_api: TestClient, reloj: RelojFalso
) -> None:
    registrar(cliente_api)
    _fallar(cliente_api, 5)
    reloj.avanzar(minutes=5)
    respuesta = iniciar_sesion(cliente_api)
    assert respuesta.headers["retry-after"] == str(10 * 60)


def test_pasada_la_ventana_el_login_correcto_responde_200(
    cliente_api: TestClient, reloj: RelojFalso
) -> None:
    registrar(cliente_api)
    _fallar(cliente_api, 5)
    reloj.avanzar(minutes=15, seconds=1)
    assert iniciar_sesion(cliente_api).status_code == 200


def test_login_correcto_reinicia_el_contador(cliente_api: TestClient) -> None:
    registrar(cliente_api)
    _fallar(cliente_api, 4)
    assert iniciar_sesion(cliente_api).status_code == 200
    _fallar(cliente_api, 4)


def test_el_bloqueo_es_por_nombre(cliente_api: TestClient) -> None:
    registrar(cliente_api, "axel")
    registrar(cliente_api, "maria")
    _fallar(cliente_api, 5, "axel")
    assert iniciar_sesion(cliente_api, "axel").status_code == 429
    assert iniciar_sesion(cliente_api, "maria").status_code == 200


def test_el_nombre_se_normaliza_para_el_limite(cliente_api: TestClient) -> None:
    registrar(cliente_api)
    _fallar(cliente_api, 3, "axel")
    _fallar(cliente_api, 2, "AXEL")
    assert iniciar_sesion(cliente_api, "Axel").status_code == 429


def test_nombres_inexistentes_tambien_se_bloquean(cliente_api: TestClient) -> None:
    _fallar(cliente_api, 5, "nadie")
    assert iniciar_sesion(cliente_api, "nadie").status_code == 429


def test_seis_registros_en_una_hora_bloquean_el_sexto_sin_crear_usuario(
    cliente_api: TestClient, session_factory: sessionmaker[Session]
) -> None:
    for i in range(5):
        assert registrar(cliente_api, f"usuario{i}").status_code == 201
    respuesta = registrar(cliente_api, "usuario5")
    assert respuesta.status_code == 429
    assert respuesta.json() == MENSAJE
    assert int(respuesta.headers["retry-after"]) > 0
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener_por_nombre_usuario("usuario5") is None


def test_pasada_una_hora_se_puede_registrar_de_nuevo(
    cliente_api: TestClient, reloj: RelojFalso
) -> None:
    for i in range(5):
        registrar(cliente_api, f"usuario{i}")
    reloj.avanzar(hours=1, seconds=1)
    assert registrar(cliente_api, "usuario5").status_code == 201


def test_veintiun_logins_en_un_minuto_bloquean_por_cliente(
    cliente_api: TestClient, reloj: RelojFalso
) -> None:
    registrar(cliente_api)
    for i in range(20):
        assert iniciar_sesion(cliente_api, f"nadie{i}").status_code == 401
    respuesta = iniciar_sesion(cliente_api, "axel")
    assert respuesta.status_code == 429
    assert respuesta.headers["retry-after"] == "60"
    reloj.avanzar(minutes=1, seconds=1)
    assert iniciar_sesion(cliente_api, "axel", CLAVE).status_code == 200


def test_el_limite_de_login_se_evalua_antes_de_llamar_al_hasher(
    cliente_api: TestClient, hasher_espia: HasherEspia
) -> None:
    registrar(cliente_api)
    _fallar(cliente_api, 5)
    verificaciones = len(hasher_espia.verificaciones)
    assert iniciar_sesion(cliente_api).status_code == 429
    assert len(hasher_espia.verificaciones) == verificaciones


def test_el_limite_de_registro_se_evalua_antes_de_hashear(
    cliente_api: TestClient, hasher_espia: HasherEspia
) -> None:
    for i in range(5):
        registrar(cliente_api, f"usuario{i}")
    hasheos: list[str] = []
    original = hasher_espia.hashear

    def hashear_espiando(contrasena: str) -> str:
        hasheos.append(contrasena)
        return original(contrasena)

    hasher_espia.hashear = hashear_espiando  # type: ignore[method-assign]
    assert registrar(cliente_api, "usuario5").status_code == 429
    assert hasheos == []
