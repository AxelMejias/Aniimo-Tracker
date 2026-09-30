from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import pytest
from sqlalchemy import Insert, String, delete, func, insert, literal, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.domain.catalogos import PosicionObjeto, Rareza, Stat
from app.domain.imagenes import TAMANO_MAXIMO, TipoDeImagen
from app.infrastructure.modelos import (
    AniimoDelTeamModelo,
    ImagenAniimoModelo,
    MaterialEstrellaModelo,
    ObjetoTransportadoModelo,
    SesionModelo,
    TeamModelo,
    UsuarioModelo,
)
from tests.imagenes_de_prueba import PNG, WEBP, con_relleno


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


_AHORA = datetime(2026, 1, 1, 10, 0, tzinfo=UTC)


def _sesion(padres: Padres, **campos: object) -> SesionModelo:
    base: dict[str, object] = {
        "id": uuid4(),
        "usuario_id": padres.usuario_id,
        "token_hash": "a" * 64,
        "creada_en": _AHORA,
        "expira_en": _AHORA + timedelta(minutes=30),
        "vence_en": _AHORA + timedelta(hours=12),
    }
    return SesionModelo(**{**base, **campos})


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
    (
        "sesion_vence_en_igual_a_creada_en",
        lambda p: _sesion(p, vence_en=_AHORA, expira_en=_AHORA),
        "ck_sesion_vence_despues_de_crear",
    ),
    (
        "sesion_vence_en_anterior_a_creada_en",
        lambda p: _sesion(
            p, vence_en=_AHORA - timedelta(hours=1), expira_en=_AHORA - timedelta(hours=1)
        ),
        "ck_sesion_vence_despues_de_crear",
    ),
    (
        "sesion_expira_en_posterior_a_vence_en",
        lambda p: _sesion(p, expira_en=_AHORA + timedelta(hours=13)),
        "ck_sesion_expira_hasta_el_tope",
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


def test_la_base_rechaza_dos_sesiones_con_el_mismo_token_hash(
    session: Session, padres: Padres
) -> None:
    session.add(_sesion(padres))
    session.flush()
    session.add(_sesion(padres))
    with pytest.raises(IntegrityError) as info:
        session.flush()
    assert _nombre_del_constraint(info.value) == "uq_sesion_token_hash"


def test_la_base_acepta_expira_en_igual_a_vence_en(session: Session, padres: Padres) -> None:
    limite = _AHORA + timedelta(hours=1)
    session.add(_sesion(padres, expira_en=limite, vence_en=limite))
    session.flush()


def test_borrar_un_usuario_borra_sus_sesiones(session: Session, padres: Padres) -> None:
    session.add(_sesion(padres))
    session.flush()
    session.execute(delete(UsuarioModelo).where(UsuarioModelo.id == padres.usuario_id))
    assert session.scalar(select(func.count()).select_from(SesionModelo)) == 0


def _insertar_imagen(padres: Padres, tipo: str, datos: bytes) -> Insert:
    return insert(ImagenAniimoModelo).values(
        aniimo_del_team_id=padres.aniimo_id,
        tipo=literal(tipo, String),
        datos=datos,
    )


@pytest.mark.parametrize(
    ("tipo", "datos", "constraint"),
    [
        ("image/svg+xml", PNG, "ck_imagen_aniimo_tipo"),
        ("image/gif", PNG, "ck_imagen_aniimo_tipo"),
        ("image/png", b"", "ck_imagen_aniimo_tamano"),
        ("image/png", con_relleno(PNG, TAMANO_MAXIMO + 1), "ck_imagen_aniimo_tamano"),
    ],
    ids=["svg", "gif", "vacia", "un_byte_de_mas"],
)
def test_la_base_rechaza_imagenes_invalidas(
    session: Session, padres: Padres, tipo: str, datos: bytes, constraint: str
) -> None:
    with pytest.raises(IntegrityError) as info:
        session.execute(_insertar_imagen(padres, tipo, datos))
    assert _nombre_del_constraint(info.value) == constraint


@pytest.mark.parametrize(
    ("tipo", "datos"),
    [
        (TipoDeImagen.PNG, con_relleno(PNG, TAMANO_MAXIMO)),
        (TipoDeImagen.WEBP, WEBP),
        (TipoDeImagen.JPEG, b"\xff\xd8\xff"),
    ],
    ids=["tope_exacto", "webp", "un_byte"],
)
def test_la_base_acepta_imagenes_validas(
    session: Session, padres: Padres, tipo: TipoDeImagen, datos: bytes
) -> None:
    session.add(ImagenAniimoModelo(aniimo_del_team_id=padres.aniimo_id, tipo=tipo, datos=datos))
    session.flush()


def _contar_imagenes(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(ImagenAniimoModelo)) or 0


def test_borrar_el_aniimo_borra_su_imagen(session: Session, padres: Padres) -> None:
    session.add(
        ImagenAniimoModelo(aniimo_del_team_id=padres.aniimo_id, tipo=TipoDeImagen.PNG, datos=PNG)
    )
    session.flush()
    session.execute(delete(AniimoDelTeamModelo).where(AniimoDelTeamModelo.id == padres.aniimo_id))
    assert _contar_imagenes(session) == 0


def test_borrar_el_team_borra_las_imagenes_de_sus_aniimo(session: Session, padres: Padres) -> None:
    session.add(
        ImagenAniimoModelo(aniimo_del_team_id=padres.aniimo_id, tipo=TipoDeImagen.PNG, datos=PNG)
    )
    session.flush()
    session.execute(delete(TeamModelo).where(TeamModelo.id == padres.team_id))
    assert _contar_imagenes(session) == 0


def test_la_base_rechaza_dos_imagenes_para_el_mismo_aniimo(
    session: Session, padres: Padres
) -> None:
    session.add(
        ImagenAniimoModelo(aniimo_del_team_id=padres.aniimo_id, tipo=TipoDeImagen.PNG, datos=PNG)
    )
    session.flush()
    session.add(
        ImagenAniimoModelo(aniimo_del_team_id=padres.aniimo_id, tipo=TipoDeImagen.WEBP, datos=WEBP)
    )
    with pytest.raises(IntegrityError):
        session.flush()
