from collections.abc import Callable
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.catalogos import Stat
from app.domain.entidades import Team, Usuario
from app.domain.errores import (
    DespertaresInconsistentes,
    ErrorDeDominio,
    ErrorDeIntegridad,
    LimiteDeTeamsAlcanzado,
    PersonalidadInvalida,
    PotencialFueraDeRango,
    SlotInvalido,
)
from app.infrastructure.modelos import AniimoDelTeamModelo, TeamModelo
from tests.fabricas import persistir_sesion, persistir_team, persistir_usuario, sesion_de_prueba


def _team_invalido(usuario_id: UUID, **campos: object) -> TeamModelo:
    base: dict[str, object] = {"id": uuid4(), "usuario_id": usuario_id, "nombre": "T", "orden": 1}
    return TeamModelo(**{**base, **campos})


def _aniimo_invalido(team_id: UUID, **campos: object) -> AniimoDelTeamModelo:
    base: dict[str, object] = {"id": uuid4(), "team_id": team_id, "slot": 1, "nombre": "A"}
    return AniimoDelTeamModelo(**{**base, **campos})


CHECKS_CON_EQUIVALENTE: list[tuple[str, type[ErrorDeDominio], Callable[[UUID, UUID], Any]]] = [
    ("orden_5", LimiteDeTeamsAlcanzado, lambda u, t: _team_invalido(u, orden=5)),
    ("slot_5", SlotInvalido, lambda u, t: _aniimo_invalido(t, slot=5)),
    ("slot_0", SlotInvalido, lambda u, t: _aniimo_invalido(t, slot=0)),
    ("personalidad", PersonalidadInvalida, lambda u, t: _aniimo_invalido(t, personalidad="EEFJ")),
    (
        "despertares",
        DespertaresInconsistentes,
        lambda u, t: _aniimo_invalido(t, despertares_usados=44, despertares_total=43),
    ),
    *[
        (
            f"potencial_{stat}",
            PotencialFueraDeRango,
            lambda u, t, s=stat: _aniimo_invalido(t, **{f"{s}_potencial": 21}),
        )
        for stat in Stat
    ],
]


@pytest.mark.parametrize(
    ("esperado", "construir"),
    [pytest.param(e, c, id=i) for i, e, c in CHECKS_CON_EQUIVALENTE],
)
def test_los_check_con_equivalente_de_dominio_lanzan_la_misma_excepcion(
    session_factory: sessionmaker[Session],
    esperado: type[ErrorDeDominio],
    construir: Callable[[UUID, UUID], Any],
) -> None:
    usuario = persistir_usuario(session_factory)
    team = persistir_team(session_factory, usuario, orden=2)
    with UnitOfWork(session_factory) as uow:
        uow.session.add(construir(usuario.id, team.id))
        with pytest.raises(esperado):
            uow.commit()


def test_un_check_sin_traduccion_especifica_es_error_de_integridad_generico(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    with UnitOfWork(session_factory) as uow:
        uow.session.add(_team_invalido(usuario.id, nombre=""))
        with pytest.raises(ErrorDeIntegridad) as info:
            uow.commit()
    assert type(info.value) is ErrorDeIntegridad


def test_una_foreign_key_rota_es_error_de_integridad_generico(
    session_factory: sessionmaker[Session],
) -> None:
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(Team(usuario_id=uuid4(), nombre="Huerfano", orden=1))
        with pytest.raises(ErrorDeIntegridad) as info:
            uow.commit()
    assert type(info.value) is ErrorDeIntegridad


def test_el_error_no_contiene_sql_ni_password_hash(
    session_factory: sessionmaker[Session],
) -> None:
    persistir_usuario(session_factory, "axel")
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.agregar(Usuario("axel", "hash-super-secreto-123"))
        with pytest.raises(ErrorDeDominio) as info:
            uow.commit()
    error = info.value
    texto = f"{error!s} {error!r}".lower()
    for prohibido in ("insert", "select", "hash-super-secreto-123", "password_hash", "usuario_"):
        assert prohibido not in texto
    assert error.__cause__ is None
    assert error.__context__ is None


def test_el_error_no_es_una_excepcion_de_sqlalchemy(
    session_factory: sessionmaker[Session],
) -> None:
    persistir_usuario(session_factory, "axel")
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.agregar(Usuario("axel", "hash"))
        with pytest.raises(ErrorDeDominio):
            uow.commit()


def test_una_nueva_uow_funciona_despues_del_error(session_factory: sessionmaker[Session]) -> None:
    persistir_usuario(session_factory, "axel")
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.agregar(Usuario("axel", "hash"))
        with pytest.raises(ErrorDeDominio):
            uow.commit()
    otro = persistir_usuario(session_factory, "otro")
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(otro.id) == otro


def test_la_misma_uow_queda_revertida_despues_del_error(
    session_factory: sessionmaker[Session],
) -> None:
    persistir_usuario(session_factory, "axel")
    nuevo = Usuario("nuevo", "hash")
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.agregar(nuevo)
        uow.usuarios.agregar(Usuario("axel", "hash"))
        with pytest.raises(ErrorDeDominio):
            uow.commit()
    with UnitOfWork(session_factory) as uow:
        assert uow.usuarios.obtener(nuevo.id) is None


def test_token_hash_repetido_es_error_de_integridad_generico(
    session_factory: sessionmaker[Session],
) -> None:
    usuario = persistir_usuario(session_factory)
    persistir_sesion(session_factory, sesion_de_prueba(usuario))
    with UnitOfWork(session_factory) as uow:
        uow.sesiones.agregar(sesion_de_prueba(usuario))
        with pytest.raises(ErrorDeIntegridad) as info:
            uow.commit()
    assert type(info.value) is ErrorDeIntegridad
