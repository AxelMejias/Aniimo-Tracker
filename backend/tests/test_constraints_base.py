from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import String, insert, literal
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.domain.catalogos import PosicionObjeto, Rareza, Stat
from app.infrastructure.modelos import (
    AniimoDelTeamModelo,
    MaterialEstrellaModelo,
    ObjetoTransportadoModelo,
    TeamModelo,
    UsuarioModelo,
)


@dataclass(frozen=True)
class Padres:
    usuario_id: UUID
    team_id: UUID
    aniimo_id: UUID


@pytest.fixture
def session(session_factory: sessionmaker[Session]) -> Session:
    with session_factory() as sesion:
        yield sesion  # type: ignore[misc]


@pytest.fixture
def padres(session: Session) -> Padres:
    usuario = UsuarioModelo(id=uuid4(), nombre_usuario="axel", password_hash="hash")
    session.add(usuario)
    session.flush()
    team = TeamModelo(id=uuid4(), usuario_id=usuario.id, nombre="Team 1", orden=1)
    session.add(team)
    session.flush()
    aniimo = AniimoDelTeamModelo(id=uuid4(), team_id=team.id, slot=1, nombre="Irisalis")
    session.add(aniimo)
    session.flush()
    return Padres(usuario.id, team.id, aniimo.id)


def _usuario(**campos: object) -> UsuarioModelo:
    base: dict[str, object] = {"id": uuid4(), "nombre_usuario": "otro", "password_hash": "hash"}
    return UsuarioModelo(**{**base, **campos})


def _team(padres: Padres, **campos: object) -> TeamModelo:
    base: dict[str, object] = {
        "id": uuid4(),
        "usuario_id": padres.usuario_id,
        "nombre": "Team X",
        "orden": 2,
    }
    return TeamModelo(**{**base, **campos})


def _aniimo(padres: Padres, **campos: object) -> AniimoDelTeamModelo:
    base: dict[str, object] = {
        "id": uuid4(),
        "team_id": padres.team_id,
        "slot": 2,
        "nombre": "Otro",
    }
    return AniimoDelTeamModelo(**{**base, **campos})


def _material(padres: Padres, **campos: object) -> MaterialEstrellaModelo:
    base: dict[str, object] = {
        "aniimo_del_team_id": padres.aniimo_id,
        "posicion": 1,
        "nombre": "Polvo",
    }
    return MaterialEstrellaModelo(**{**base, **campos})


def _objeto(padres: Padres, **campos: object) -> ObjetoTransportadoModelo:
    base: dict[str, object] = {
        "aniimo_del_team_id": padres.aniimo_id,
        "posicion": PosicionObjeto.EQUIPADO,
        "nombre": "Anillo",
        "rareza": Rareza.RARA,
    }
    return ObjetoTransportadoModelo(**{**base, **campos})


def _casos_de_stats() -> list[tuple[str, Callable[[Padres], Any], str]]:
    casos: list[tuple[str, Callable[[Padres], Any], str]] = []
    for stat in Stat:
        prefijo = f"ck_aniimo_del_team_{stat}"
        for potencial in (21, -1):
            casos.append(
                (
                    f"{stat}_potencial_{potencial}",
                    lambda p, s=stat, v=potencial: _aniimo(p, **{f"{s}_potencial": v}),
                    f"{prefijo}_potencial_rango",
                )
            )
        casos.append(
            (
                f"{stat}_valor_negativo",
                lambda p, s=stat: _aniimo(p, **{f"{s}_valor": -5}),
                f"{prefijo}_valor_no_negativo",
            )
        )
        casos.append(
            (
                f"{stat}_bono_estrellas_negativo",
                lambda p, s=stat: _aniimo(p, **{f"{s}_bono_estrellas": -1}),
                f"{prefijo}_bono_estrellas_no_negativo",
            )
        )
    return casos


CASOS_INVALIDOS: list[tuple[str, Callable[[Padres], Any], str]] = [
    (
        "nombre_usuario_con_mayuscula",
        lambda p: _usuario(nombre_usuario="Axel"),
        "ck_usuario_nombre_usuario_minuscula",
    ),
    (
        "nombre_usuario_vacio",
        lambda p: _usuario(nombre_usuario=""),
        "ck_usuario_nombre_usuario_no_vacio",
    ),
    ("team_orden_5", lambda p: _team(p, orden=5), "ck_team_orden_rango"),
    ("team_orden_0", lambda p: _team(p, orden=0), "ck_team_orden_rango"),
    ("team_nombre_vacio", lambda p: _team(p, nombre=""), "ck_team_nombre_no_vacio"),
    ("slot_0", lambda p: _aniimo(p, slot=0), "ck_aniimo_del_team_slot_rango"),
    ("slot_5", lambda p: _aniimo(p, slot=5), "ck_aniimo_del_team_slot_rango"),
    ("aniimo_nombre_vacio", lambda p: _aniimo(p, nombre=""), "ck_aniimo_del_team_nombre_no_vacio"),
    *_casos_de_stats(),
    ("nivel_0", lambda p: _aniimo(p, nivel=0), "ck_aniimo_del_team_nivel_minimo"),
    ("cp_negativo", lambda p: _aniimo(p, cp=-1), "ck_aniimo_del_team_cp_no_negativo"),
    (
        "personalidad_EEFJ",
        lambda p: _aniimo(p, personalidad="EEFJ"),
        "ck_aniimo_del_team_personalidad_formato",
    ),
    (
        "personalidad_minuscula",
        lambda p: _aniimo(p, personalidad="enfj"),
        "ck_aniimo_del_team_personalidad_formato",
    ),
    (
        "personalidad_incompleta",
        lambda p: _aniimo(p, personalidad="ENF"),
        "ck_aniimo_del_team_personalidad_formato",
    ),
    (
        "despertares_44_de_43",
        lambda p: _aniimo(p, despertares_usados=44, despertares_total=43),
        "ck_aniimo_del_team_despertares_consistentes",
    ),
    (
        "estrella_negativa",
        lambda p: _aniimo(p, estrella_actual=-1),
        "ck_aniimo_del_team_estrella_actual_no_negativa",
    ),
    (
        "nivel_requerido_0",
        lambda p: _aniimo(p, nivel_requerido_siguiente_etapa=0),
        "ck_aniimo_del_team_nivel_requerido_siguiente_etapa_minimo",
    ),
    (
        "material_posicion_4",
        lambda p: _material(p, posicion=4),
        "ck_material_estrella_posicion_rango",
    ),
    (
        "material_posicion_0",
        lambda p: _material(p, posicion=0),
        "ck_material_estrella_posicion_rango",
    ),
    (
        "material_tengo_negativo",
        lambda p: _material(p, tengo=-1),
        "ck_material_estrella_tengo_no_negativo",
    ),
    (
        "material_necesito_negativo",
        lambda p: _material(p, necesito=-1),
        "ck_material_estrella_necesito_no_negativo",
    ),
    (
        "material_nombre_vacio",
        lambda p: _material(p, nombre=""),
        "ck_material_estrella_nombre_no_vacio",
    ),
    ("objeto_nivel_0", lambda p: _objeto(p, nivel=0), "ck_objeto_transportado_nivel_minimo"),
    (
        "objeto_nombre_vacio",
        lambda p: _objeto(p, nombre=""),
        "ck_objeto_transportado_nombre_no_vacio",
    ),
]


def _nombre_del_constraint(error: IntegrityError) -> str:
    return error.orig.diag.constraint_name  # type: ignore[union-attr]


@pytest.mark.parametrize(
    ("construir", "constraint"),
    [pytest.param(c, n, id=i) for i, c, n in CASOS_INVALIDOS],
)
def test_la_base_rechaza_filas_invalidas(
    session: Session, padres: Padres, construir: Callable[[Padres], Any], constraint: str
) -> None:
    session.add(construir(padres))
    with pytest.raises(IntegrityError) as info:
        session.flush()
    assert _nombre_del_constraint(info.value) == constraint


# El tipo Enum de SQLAlchemy rechaza en el bind los valores fuera del catalogo antes de llegar a la
# base; el valor se envia como parametro de tipo String para probar el CHECK de la base.
@pytest.mark.parametrize(
    ("tabla", "columna", "valor", "constraint"),
    [
        (AniimoDelTeamModelo, "elemento", "metal", "ck_aniimo_del_team_elemento"),
        (AniimoDelTeamModelo, "rol", "mago", "ck_aniimo_del_team_rol"),
        (AniimoDelTeamModelo, "potencial_innato", "divino", "ck_aniimo_del_team_potencial_innato"),
    ],
)
def test_la_base_rechaza_valores_fuera_del_catalogo_del_aniimo(
    session: Session, padres: Padres, tabla: type, columna: str, valor: str, constraint: str
) -> None:
    sentencia = insert(tabla).values(
        id=uuid4(),
        team_id=padres.team_id,
        slot=3,
        nombre="Otro",
        **{columna: literal(valor, String)},
    )
    with pytest.raises(IntegrityError) as info:
        session.execute(sentencia)
    assert _nombre_del_constraint(info.value) == constraint


@pytest.mark.parametrize(
    ("columna", "valor", "constraint"),
    [
        ("posicion", "reserva", "ck_objeto_transportado_posicion"),
        ("rareza", "comun", "ck_objeto_transportado_rareza"),
    ],
)
def test_la_base_rechaza_valores_fuera_del_catalogo_del_objeto(
    session: Session, padres: Padres, columna: str, valor: str, constraint: str
) -> None:
    valores: dict[str, Any] = {
        "aniimo_del_team_id": padres.aniimo_id,
        "posicion": literal("alternativo", String),
        "nombre": "Anillo",
        "rareza": literal("rara", String),
    }
    valores[columna] = literal(valor, String)
    with pytest.raises(IntegrityError) as info:
        session.execute(insert(ObjetoTransportadoModelo).values(**valores))
    assert _nombre_del_constraint(info.value) == constraint


@pytest.mark.parametrize("nivel", [100, 61, 1])
def test_la_base_acepta_niveles_altos(session: Session, padres: Padres, nivel: int) -> None:
    session.add(_aniimo(padres, nivel=nivel))
    session.flush()


@pytest.mark.parametrize(("tengo", "necesito"), [(413, 60), (1, 2), (0, 0)])
def test_la_base_acepta_tengo_mayor_que_necesito(
    session: Session, padres: Padres, tengo: int, necesito: int
) -> None:
    session.add(_material(padres, tengo=tengo, necesito=necesito))
    session.flush()


@pytest.mark.parametrize("personalidad", ["ENFJ", "ISTP", None])
def test_la_base_acepta_personalidades_validas_y_vacia(
    session: Session, padres: Padres, personalidad: str | None
) -> None:
    session.add(_aniimo(padres, personalidad=personalidad))
    session.flush()
