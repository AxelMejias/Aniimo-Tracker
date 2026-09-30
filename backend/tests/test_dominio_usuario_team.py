from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from app.domain.entidades import Team, Usuario, normalizar_nombre_usuario
from app.domain.errores import ErrorDeValidacion, LimiteDeTeamsAlcanzado, ValorInvalido


@pytest.mark.parametrize("nombre", ["Axel", "AXEL", "axel"])
def test_usuario_normaliza_el_nombre_a_minuscula(nombre: str) -> None:
    assert Usuario(nombre, "hash").nombre_usuario == "axel"


def test_normalizar_nombre_usuario_es_la_funcion_que_usa_la_entidad() -> None:
    assert Usuario("AxEl", "hash").nombre_usuario == normalizar_nombre_usuario("AxEl")
    assert normalizar_nombre_usuario("MARIA") == "maria"


def test_usuario_con_nombre_vacio_falla() -> None:
    with pytest.raises(ValorInvalido) as info:
        Usuario("", "hash")
    assert "nombre_usuario" in str(info.value)


def test_usuario_genera_id_uuid_y_fecha_de_creacion() -> None:
    antes = datetime.now(UTC)
    usuario = Usuario("axel", "hash")
    assert isinstance(usuario.id, UUID)
    assert antes <= usuario.creado_en <= datetime.now(UTC)
    assert usuario.creado_en.tzinfo is not None


def test_dos_usuarios_no_comparten_id() -> None:
    assert Usuario("a", "h").id != Usuario("b", "h").id


def test_usuario_es_inmutable() -> None:
    usuario = Usuario("axel", "hash")
    with pytest.raises(AttributeError):
        usuario.nombre_usuario = "otro"  # type: ignore[misc]


@pytest.mark.parametrize("orden", [1, 2, 3, 4])
def test_team_acepta_orden_de_1_a_4(orden: int) -> None:
    assert Team(usuario_id=uuid4(), nombre="Team", orden=orden).orden == orden


@pytest.mark.parametrize("orden", [0, 5, -1])
def test_team_con_orden_fuera_de_rango_es_limite_de_teams(orden: int) -> None:
    with pytest.raises(LimiteDeTeamsAlcanzado):
        Team(usuario_id=uuid4(), nombre="Team", orden=orden)


def test_team_con_nombre_vacio_falla() -> None:
    with pytest.raises(ValorInvalido) as info:
        Team(usuario_id=uuid4(), nombre="", orden=1)
    assert "nombre" in str(info.value)


def test_limite_de_teams_es_un_error_de_validacion() -> None:
    with pytest.raises(ErrorDeValidacion):
        Team(usuario_id=uuid4(), nombre="Team", orden=5)
