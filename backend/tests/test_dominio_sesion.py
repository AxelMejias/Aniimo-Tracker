import dataclasses
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.domain.entidades import Sesion
from app.domain.errores import (
    CredencialesInvalidas,
    ErrorDeDominio,
    SesionInvalida,
    ValorInvalido,
)

CREADA = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
INACTIVIDAD = timedelta(minutes=30)


def _sesion(expira_en: datetime | None = None, vence_en: datetime | None = None) -> Sesion:
    return Sesion(
        usuario_id=uuid4(),
        token_hash="a" * 64,
        creada_en=CREADA,
        expira_en=expira_en or CREADA + INACTIVIDAD,
        vence_en=vence_en or CREADA + timedelta(hours=12),
    )


def test_vigente_un_segundo_antes_de_expira_en() -> None:
    sesion = _sesion()
    assert sesion.vigente(sesion.expira_en - timedelta(seconds=1))


def test_no_vigente_exactamente_en_expira_en() -> None:
    sesion = _sesion()
    assert not sesion.vigente(sesion.expira_en)


def test_no_vigente_despues_de_expira_en() -> None:
    sesion = _sesion()
    assert not sesion.vigente(sesion.expira_en + timedelta(seconds=1))


def test_vigente_un_segundo_antes_de_vence_en() -> None:
    limite = CREADA + timedelta(hours=1)
    sesion = _sesion(expira_en=limite, vence_en=limite)
    assert sesion.vigente(limite - timedelta(seconds=1))


def test_no_vigente_exactamente_en_vence_en() -> None:
    limite = CREADA + timedelta(hours=1)
    sesion = _sesion(expira_en=limite, vence_en=limite)
    assert not sesion.vigente(limite)


def test_renovada_cerca_del_tope_queda_en_vence_en() -> None:
    vence_en = CREADA + timedelta(hours=12)
    sesion = _sesion(expira_en=vence_en - timedelta(minutes=5), vence_en=vence_en)
    ahora = vence_en - timedelta(minutes=10)
    assert sesion.renovada(ahora, INACTIVIDAD).expira_en == vence_en


def test_renovada_lejos_del_tope_suma_la_inactividad() -> None:
    sesion = _sesion()
    ahora = CREADA + timedelta(minutes=20)
    renovada = sesion.renovada(ahora, INACTIVIDAD)
    assert renovada.expira_en == ahora + INACTIVIDAD
    assert renovada.vence_en == sesion.vence_en
    assert renovada.id == sesion.id


def test_renovada_no_modifica_la_original() -> None:
    sesion = _sesion()
    original = sesion.expira_en
    sesion.renovada(CREADA + timedelta(minutes=20), INACTIVIDAD)
    assert sesion.expira_en == original


def test_expira_en_posterior_a_vence_en_es_valor_invalido() -> None:
    vence_en = CREADA + timedelta(hours=1)
    with pytest.raises(ValorInvalido) as info:
        _sesion(expira_en=vence_en + timedelta(seconds=1), vence_en=vence_en)
    assert "expira_en" in str(info.value)


def test_replace_revalida() -> None:
    sesion = _sesion()
    with pytest.raises(ValorInvalido):
        dataclasses.replace(sesion, expira_en=sesion.vence_en + timedelta(minutes=1))


def test_expira_en_igual_a_vence_en_es_valido() -> None:
    limite = CREADA + timedelta(hours=1)
    assert _sesion(expira_en=limite, vence_en=limite).expira_en == limite


def test_errores_de_auth_tienen_mensaje_fijo_y_son_de_dominio() -> None:
    assert str(CredencialesInvalidas()) == "Credenciales inválidas"
    assert str(SesionInvalida()) == "No autenticado"
    assert issubclass(CredencialesInvalidas, ErrorDeDominio)
    assert issubclass(SesionInvalida, ErrorDeDominio)
