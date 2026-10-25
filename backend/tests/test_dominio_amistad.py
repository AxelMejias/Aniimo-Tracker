from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.domain.entidades import Amistad, EstadoDeAmistad
from app.domain.errores import (
    AmistadExistente,
    AmistadNoEncontrada,
    AutoAmistad,
    EntidadNoEncontrada,
    ErrorDeIntegridad,
    ErrorDeValidacion,
    UsuarioNoEncontrado,
)

AHORA = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)


def _dos_ids() -> tuple[UUID, UUID]:
    a, b = sorted((uuid4(), uuid4()))
    return a, b


def test_par_ordenado_cuando_pide_el_menor() -> None:
    menor, mayor = _dos_ids()
    amistad = Amistad.solicitar(menor, mayor)
    assert (amistad.usuario_a_id, amistad.usuario_b_id) == (menor, mayor)
    assert amistad.solicitante_id == menor


def test_par_ordenado_cuando_pide_el_mayor() -> None:
    menor, mayor = _dos_ids()
    amistad = Amistad.solicitar(mayor, menor)
    assert (amistad.usuario_a_id, amistad.usuario_b_id) == (menor, mayor)
    assert amistad.solicitante_id == mayor


def test_la_solicitud_nace_pendiente_y_sin_fecha_de_aceptacion() -> None:
    amistad = Amistad.solicitar(uuid4(), uuid4())
    assert amistad.estado is EstadoDeAmistad.PENDIENTE
    assert amistad.aceptada_en is None
    assert amistad.creada_en.tzinfo is not None


def test_auto_amistad() -> None:
    usuario = uuid4()
    with pytest.raises(AutoAmistad):
        Amistad.solicitar(usuario, usuario)


def test_aceptar_conserva_par_y_solicitante() -> None:
    menor, mayor = _dos_ids()
    pendiente = Amistad.solicitar(mayor, menor)
    aceptada = pendiente.aceptar(AHORA)
    assert aceptada.estado is EstadoDeAmistad.ACEPTADA
    assert aceptada.aceptada_en == AHORA
    assert (aceptada.usuario_a_id, aceptada.usuario_b_id) == (menor, mayor)
    assert aceptada.solicitante_id == mayor
    assert aceptada.id == pendiente.id
    assert pendiente.estado is EstadoDeAmistad.PENDIENTE


def test_aceptar_en_otro_instante() -> None:
    otro = datetime(2027, 1, 1, tzinfo=UTC)
    assert Amistad.solicitar(uuid4(), uuid4()).aceptar(otro).aceptada_en == otro


def test_otro_devuelve_al_otro_miembro_en_ambas_direcciones() -> None:
    menor, mayor = _dos_ids()
    amistad = Amistad.solicitar(menor, mayor)
    assert amistad.otro(menor) == mayor
    assert amistad.otro(mayor) == menor


def test_otro_rechaza_a_quien_no_es_parte() -> None:
    amistad = Amistad.solicitar(uuid4(), uuid4())
    with pytest.raises(AmistadNoEncontrada):
        amistad.otro(uuid4())


def test_errores_nuevos_y_su_jerarquia() -> None:
    assert isinstance(AutoAmistad(), ErrorDeValidacion)
    assert isinstance(AmistadExistente(), ErrorDeIntegridad)
    for clase in (AmistadNoEncontrada, UsuarioNoEncontrado):
        assert isinstance(clase(), EntidadNoEncontrada)
        assert str(clase()) == "No encontrado"
