import hashlib
from datetime import timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.application.auth import ServicioDeAuth
from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import Usuario
from app.domain.errores import CredencialesInvalidas, NombreUsuarioDuplicado, SesionInvalida
from app.infrastructure.contrasenas import HasherArgon2
from tests.fabricas import CLAVE, HasherEspia, RelojFalso, hasher_barato, persistir_usuario

INACTIVIDAD = timedelta(minutes=30)
TOPE = timedelta(hours=12)


def _hasher_barato(time_cost: int = 1) -> HasherArgon2:
    return hasher_barato(time_cost)


@pytest.fixture
def servicio(
    session_factory: sessionmaker[Session], hasher_espia: HasherEspia, reloj: RelojFalso
) -> ServicioDeAuth:
    return ServicioDeAuth(
        session_factory, hasher_espia, inactividad=INACTIVIDAD, tope=TOPE, reloj=reloj
    )


def _filas_de_sesion(session_factory: sessionmaker[Session]) -> list[str]:
    with session_factory() as session:
        return [fila[0] for fila in session.execute(text("SELECT token_hash FROM sesion"))]


def test_registrar_persiste_usuario_normalizado_con_hash_argon2id(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session]
) -> None:
    usuario = servicio.registrar("Axel", CLAVE)
    assert usuario.nombre_usuario == "axel"
    with UnitOfWork(session_factory) as uow:
        guardado = uow.usuarios.obtener_por_nombre_usuario("axel")
    assert guardado == usuario
    assert guardado.password_hash.startswith("$argon2id$")
    assert CLAVE not in guardado.password_hash


@pytest.mark.parametrize("repetido", ["axel", "AXEL", "Axel"])
def test_registrar_nombre_repetido_falla(servicio: ServicioDeAuth, repetido: str) -> None:
    servicio.registrar("axel", CLAVE)
    with pytest.raises(NombreUsuarioDuplicado):
        servicio.registrar(repetido, CLAVE)


def test_iniciar_sesion_devuelve_token_y_guarda_solo_su_sha256(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session], reloj: RelojFalso
) -> None:
    servicio.registrar("axel", CLAVE)
    token, sesion = servicio.iniciar_sesion("Axel", CLAVE)
    assert len(token) >= 43
    assert sesion.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert sesion.expira_en == reloj.ahora + INACTIVIDAD
    assert sesion.vence_en == reloj.ahora + TOPE
    assert _filas_de_sesion(session_factory) == [sesion.token_hash]
    assert token not in _filas_de_sesion(session_factory)


def test_dos_logins_generan_tokens_distintos(servicio: ServicioDeAuth) -> None:
    servicio.registrar("axel", CLAVE)
    assert servicio.iniciar_sesion("axel", CLAVE)[0] != servicio.iniciar_sesion("axel", CLAVE)[0]


def test_contrasena_incorrecta_falla_y_no_crea_sesion(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session]
) -> None:
    servicio.registrar("axel", CLAVE)
    with pytest.raises(CredencialesInvalidas):
        servicio.iniciar_sesion("axel", "otra-clave-larga")
    assert _filas_de_sesion(session_factory) == []


def test_usuario_inexistente_falla_y_verifica_contra_el_hash_ficticio(
    servicio: ServicioDeAuth, hasher_espia: HasherEspia
) -> None:
    with pytest.raises(CredencialesInvalidas):
        servicio.iniciar_sesion("nadie", CLAVE)
    assert len(hasher_espia.verificaciones) == 1
    assert hasher_espia.verificaciones[0].startswith("$argon2id$")


def test_usuario_existente_tambien_verifica_una_vez(
    servicio: ServicioDeAuth, hasher_espia: HasherEspia
) -> None:
    servicio.registrar("axel", CLAVE)
    with pytest.raises(CredencialesInvalidas):
        servicio.iniciar_sesion("axel", "otra-clave-larga")
    assert len(hasher_espia.verificaciones) == 1


def test_usuario_ajeno_no_altera_el_resultado(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session]
) -> None:
    persistir_usuario(session_factory, "otro")
    with pytest.raises(CredencialesInvalidas):
        servicio.iniciar_sesion("axel", CLAVE)


def test_iniciar_sesion_borra_las_sesiones_vencidas_del_usuario(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session], reloj: RelojFalso
) -> None:
    servicio.registrar("axel", CLAVE)
    _, vieja = servicio.iniciar_sesion("axel", CLAVE)
    reloj.avanzar(minutes=31)
    _, nueva = servicio.iniciar_sesion("axel", CLAVE)
    assert _filas_de_sesion(session_factory) == [nueva.token_hash]
    assert vieja.token_hash != nueva.token_hash


def test_iniciar_sesion_conserva_las_sesiones_vigentes(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session]
) -> None:
    servicio.registrar("axel", CLAVE)
    _, una = servicio.iniciar_sesion("axel", CLAVE)
    _, otra = servicio.iniciar_sesion("axel", CLAVE)
    assert set(_filas_de_sesion(session_factory)) == {una.token_hash, otra.token_hash}


def test_login_correcto_reemplaza_un_hash_con_parametros_viejos(
    session_factory: sessionmaker[Session], reloj: RelojFalso
) -> None:
    viejo = _hasher_barato(time_cost=1).hashear(CLAVE)
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.agregar(Usuario("axel", viejo))
        uow.commit()
    vigente = _hasher_barato(time_cost=2)
    servicio = ServicioDeAuth(
        session_factory, vigente, inactividad=INACTIVIDAD, tope=TOPE, reloj=reloj
    )
    servicio.iniciar_sesion("axel", CLAVE)
    with UnitOfWork(session_factory) as uow:
        nuevo = uow.usuarios.obtener_por_nombre_usuario("axel").password_hash
    assert nuevo != viejo
    assert "t=2" in nuevo
    assert vigente.verificar(CLAVE, nuevo)


def test_login_correcto_no_cambia_un_hash_vigente(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session]
) -> None:
    usuario = servicio.registrar("axel", CLAVE)
    servicio.iniciar_sesion("axel", CLAVE)
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(usuario.id).password_hash == usuario.password_hash


def test_autenticar_con_token_valido_devuelve_el_usuario_y_renueva(
    servicio: ServicioDeAuth, reloj: RelojFalso
) -> None:
    usuario = servicio.registrar("axel", CLAVE)
    token, _ = servicio.iniciar_sesion("axel", CLAVE)
    reloj.avanzar(minutes=10)
    autenticado, sesion = servicio.autenticar(token)
    assert autenticado == usuario
    assert sesion.expira_en == reloj.ahora + INACTIVIDAD


def test_la_renovacion_queda_persistida(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session], reloj: RelojFalso
) -> None:
    servicio.registrar("axel", CLAVE)
    token, _ = servicio.iniciar_sesion("axel", CLAVE)
    reloj.avanzar(minutes=10)
    _, sesion = servicio.autenticar(token)
    with UnitOfWork(session_factory) as uow:
        assert uow.sesiones.obtener(sesion.id) == sesion


def test_uso_a_los_20_y_40_minutos_con_inactividad_de_30_funciona(
    servicio: ServicioDeAuth, reloj: RelojFalso
) -> None:
    servicio.registrar("axel", CLAVE)
    token, _ = servicio.iniciar_sesion("axel", CLAVE)
    reloj.avanzar(minutes=20)
    servicio.autenticar(token)
    reloj.avanzar(minutes=20)
    servicio.autenticar(token)


def test_token_inexistente_es_sesion_invalida(servicio: ServicioDeAuth) -> None:
    with pytest.raises(SesionInvalida):
        servicio.autenticar("token-inventado")


def test_inactividad_vencida_es_sesion_invalida_y_borra_la_sesion(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session], reloj: RelojFalso
) -> None:
    servicio.registrar("axel", CLAVE)
    token, _ = servicio.iniciar_sesion("axel", CLAVE)
    reloj.avanzar(minutes=30)
    with pytest.raises(SesionInvalida):
        servicio.autenticar(token)
    assert _filas_de_sesion(session_factory) == []


def test_tope_absoluto_vencido_es_sesion_invalida_aunque_se_use(
    servicio: ServicioDeAuth, session_factory: sessionmaker[Session], reloj: RelojFalso
) -> None:
    servicio.registrar("axel", CLAVE)
    token, _ = servicio.iniciar_sesion("axel", CLAVE)
    for _ in range(71):
        reloj.avanzar(minutes=10)
        servicio.autenticar(token)
    reloj.avanzar(minutes=10)
    with pytest.raises(SesionInvalida):
        servicio.autenticar(token)
    assert _filas_de_sesion(session_factory) == []


def test_cerrar_sesion_borra_solo_esa_sesion(servicio: ServicioDeAuth) -> None:
    servicio.registrar("axel", CLAVE)
    token_uno, sesion_uno = servicio.iniciar_sesion("axel", CLAVE)
    token_dos, _ = servicio.iniciar_sesion("axel", CLAVE)
    servicio.cerrar_sesion(sesion_uno.id)
    with pytest.raises(SesionInvalida):
        servicio.autenticar(token_uno)
    servicio.autenticar(token_dos)
