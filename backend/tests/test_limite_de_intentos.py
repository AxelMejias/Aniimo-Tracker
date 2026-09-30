from datetime import timedelta

from app.api.limite_de_intentos import (
    LimitadorDeIntentos,
    crear_limitadores,
)
from tests.fabricas import RelojFalso


def _limitador(reloj: RelojFalso, maximo: int = 3, minutos: int = 10) -> LimitadorDeIntentos:
    return LimitadorDeIntentos(maximo, timedelta(minutes=minutos), reloj)


def test_permite_hasta_el_umbral_y_bloquea_el_siguiente() -> None:
    limitador = _limitador(RelojFalso())
    assert [limitador.intentar("a") for _ in range(4)] == [True, True, True, False]


def test_un_umbral_distinto_bloquea_en_otro_punto() -> None:
    limitador = _limitador(RelojFalso(), maximo=1)
    assert [limitador.intentar("a") for _ in range(2)] == [True, False]


def test_reintentar_en_es_cero_si_no_esta_bloqueado() -> None:
    limitador = _limitador(RelojFalso())
    limitador.registrar("a")
    assert not limitador.excedido("a")
    assert limitador.reintentar_en("a") == 0


def test_reintentar_en_devuelve_segundos_hasta_que_salga_el_intento_mas_viejo() -> None:
    reloj = RelojFalso()
    limitador = _limitador(reloj)
    for _ in range(3):
        limitador.registrar("a")
        reloj.avanzar(minutes=1)
    assert limitador.excedido("a")
    assert limitador.reintentar_en("a") == 7 * 60


def test_reintentar_en_redondea_hacia_arriba_y_nunca_es_cero_si_esta_bloqueado() -> None:
    reloj = RelojFalso()
    limitador = _limitador(reloj)
    for _ in range(3):
        limitador.registrar("a")
    reloj.avanzar(minutes=10, seconds=-0.5)
    assert limitador.excedido("a")
    assert limitador.reintentar_en("a") == 1


def test_la_ventana_es_deslizante() -> None:
    reloj = RelojFalso()
    limitador = _limitador(reloj)
    limitador.registrar("a")
    reloj.avanzar(minutes=6)
    limitador.registrar("a")
    limitador.registrar("a")
    assert limitador.excedido("a")
    reloj.avanzar(minutes=4)
    assert not limitador.excedido("a")
    assert limitador.intentar("a")
    assert limitador.excedido("a")


def test_un_intento_deja_la_ventana_exactamente_al_cumplirse_el_plazo() -> None:
    reloj = RelojFalso()
    limitador = _limitador(reloj, maximo=1)
    limitador.registrar("a")
    reloj.avanzar(minutes=10, seconds=-1)
    assert limitador.excedido("a")
    reloj.avanzar(seconds=1)
    assert not limitador.excedido("a")


def test_reiniciar_limpia_la_clave() -> None:
    limitador = _limitador(RelojFalso())
    for _ in range(3):
        limitador.registrar("a")
    limitador.reiniciar("a")
    assert not limitador.excedido("a")
    assert limitador.intentar("a")


def test_reiniciar_una_clave_desconocida_no_falla() -> None:
    _limitador(RelojFalso()).reiniciar("nadie")


def test_las_claves_son_independientes() -> None:
    limitador = _limitador(RelojFalso(), maximo=1)
    limitador.registrar("a")
    assert limitador.excedido("a")
    assert not limitador.excedido("b")
    assert limitador.intentar("b")
    limitador.reiniciar("a")
    assert limitador.excedido("b")


def test_consultar_no_registra_intentos() -> None:
    limitador = _limitador(RelojFalso(), maximo=1)
    for _ in range(5):
        assert not limitador.excedido("a")


def test_los_limites_de_auth_usan_los_umbrales_definidos() -> None:
    reloj = RelojFalso()
    limites = crear_limitadores(reloj)
    for _ in range(5):
        limites.login_fallido.registrar("axel")
    assert limites.login_fallido.excedido("axel")
    assert limites.login_fallido.reintentar_en("axel") == 15 * 60
    assert [limites.login_por_cliente.intentar("c") for _ in range(21)].count(True) == 20
    assert [limites.registro_por_cliente.intentar("c") for _ in range(6)].count(True) == 5
    assert limites.registro_por_cliente.reintentar_en("c") == 60 * 60
    assert limites.login_por_cliente.reintentar_en("c") == 60
