from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    CHAR,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, MappedColumn, mapped_column, relationship

from app.domain.catalogos import Elemento, PosicionObjeto, PotencialInnato, Rareza, Rol, Stat
from app.domain.imagenes import TAMANO_MAXIMO, TipoDeImagen
from app.infrastructure.database import Base

# Holgado a proposito: un tipo fuera del catalogo (p. ej. image/svg+xml) debe llegar al CHECK y no
# fallar antes por largo de columna.
_LONGITUD_TIPO_DE_IMAGEN = 32


def _enum(catalogo: type[StrEnum], nombre: str, longitud: int | None = None) -> Enum:
    # Se guarda el código en minúscula y un CHECK rechaza cualquier valor fuera del catálogo.
    return Enum(
        catalogo,
        name=nombre,
        native_enum=False,
        create_constraint=True,
        values_callable=lambda miembros: [m.value for m in miembros],
        length=longitud or max(len(m.value) for m in catalogo),
    )


def _columnas_de_stats() -> dict[str, MappedColumn]:
    columnas: dict[str, MappedColumn] = {}
    for stat in Stat:
        columnas[f"{stat}_valor"] = mapped_column(Integer, nullable=False, server_default=text("0"))
        columnas[f"{stat}_potencial"] = mapped_column(
            SmallInteger, nullable=False, server_default=text("0")
        )
        columnas[f"{stat}_bono_estrellas"] = mapped_column(
            Integer, nullable=False, server_default=text("0")
        )
        columnas[f"{stat}_notas"] = mapped_column(Text, nullable=True)
    return columnas


def _checks_de_stats() -> tuple[CheckConstraint, ...]:
    checks: list[CheckConstraint] = []
    for stat in Stat:
        checks.append(CheckConstraint(f"{stat}_valor >= 0", name=f"{stat}_valor_no_negativo"))
        checks.append(
            CheckConstraint(f"{stat}_potencial BETWEEN 0 AND 20", name=f"{stat}_potencial_rango")
        )
        checks.append(
            CheckConstraint(
                f"{stat}_bono_estrellas >= 0", name=f"{stat}_bono_estrellas_no_negativo"
            )
        )
    return tuple(checks)


class UsuarioModelo(Base):
    __tablename__ = "usuario"
    __table_args__ = (
        CheckConstraint("nombre_usuario = lower(nombre_usuario)", name="nombre_usuario_minuscula"),
        CheckConstraint("nombre_usuario <> ''", name="nombre_usuario_no_vacio"),
        UniqueConstraint("nombre_usuario"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    nombre_usuario: Mapped[str] = mapped_column(String(32))
    password_hash: Mapped[str] = mapped_column(String(255))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Sin estas relaciones el flush no ordena los INSERT respetando las claves foraneas.
    teams: Mapped[list["TeamModelo"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )
    sesiones: Mapped[list["SesionModelo"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )


class SesionModelo(Base):
    __tablename__ = "sesion"
    __table_args__ = (
        CheckConstraint("vence_en > creada_en", name="vence_despues_de_crear"),
        CheckConstraint("expira_en <= vence_en", name="expira_hasta_el_tope"),
        UniqueConstraint("token_hash"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(CHAR(64))
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    vence_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TeamModelo(Base):
    __tablename__ = "team"
    __table_args__ = (
        CheckConstraint("nombre <> ''", name="nombre_no_vacio"),
        CheckConstraint("orden BETWEEN 1 AND 4", name="orden_rango"),
        UniqueConstraint("usuario_id", "orden"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    usuario_id: Mapped[UUID] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"))
    nombre: Mapped[str] = mapped_column(String(50))
    orden: Mapped[int] = mapped_column(SmallInteger)

    aniimos: Mapped[list["AniimoDelTeamModelo"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True
    )


class AniimoDelTeamModelo(Base):
    __tablename__ = "aniimo_del_team"
    __table_args__ = (
        CheckConstraint("slot BETWEEN 1 AND 4", name="slot_rango"),
        CheckConstraint("nombre <> ''", name="nombre_no_vacio"),
        CheckConstraint("nivel >= 1", name="nivel_minimo"),
        CheckConstraint("cp >= 0", name="cp_no_negativo"),
        CheckConstraint("personalidad ~ '^[EI][NS][TF][JP]$'", name="personalidad_formato"),
        CheckConstraint("estrella_actual >= 0", name="estrella_actual_no_negativa"),
        CheckConstraint(
            "nivel_requerido_siguiente_etapa >= 1", name="nivel_requerido_siguiente_etapa_minimo"
        ),
        CheckConstraint("ganancia_despertar >= 0", name="ganancia_despertar_no_negativa"),
        CheckConstraint(
            "ganancia_seis_potenciales >= 0", name="ganancia_seis_potenciales_no_negativa"
        ),
        CheckConstraint("despertares_usados >= 0", name="despertares_usados_no_negativo"),
        CheckConstraint("despertares_total >= 0", name="despertares_total_no_negativo"),
        CheckConstraint("despertares_usados <= despertares_total", name="despertares_consistentes"),
        *_checks_de_stats(),
        UniqueConstraint("team_id", "slot"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True)
    team_id: Mapped[UUID] = mapped_column(ForeignKey("team.id", ondelete="CASCADE"))
    slot: Mapped[int] = mapped_column(SmallInteger)
    nombre: Mapped[str] = mapped_column(String(50))
    elemento: Mapped[Elemento | None] = mapped_column(_enum(Elemento, "elemento"))
    rol: Mapped[Rol | None] = mapped_column(_enum(Rol, "rol"))
    potencial_innato: Mapped[PotencialInnato | None] = mapped_column(
        _enum(PotencialInnato, "potencial_innato")
    )
    personalidad: Mapped[str | None] = mapped_column(CHAR(4))
    nivel: Mapped[int] = mapped_column(Integer, server_default=text("1"))
    cp: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    estrella_actual: Mapped[int] = mapped_column(SmallInteger, server_default=text("0"))
    nivel_requerido_siguiente_etapa: Mapped[int | None] = mapped_column(Integer)
    ganancia_despertar: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    ganancia_seis_potenciales: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    despertares_usados: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    despertares_total: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    notas_habilidades: Mapped[str | None] = mapped_column(Text)
    notas: Mapped[str | None] = mapped_column(Text)

    vars().update(_columnas_de_stats())

    materiales: Mapped[list["MaterialEstrellaModelo"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="MaterialEstrellaModelo.posicion",
    )
    objetos: Mapped[list["ObjetoTransportadoModelo"]] = relationship(
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ObjetoTransportadoModelo.posicion",
    )


class MaterialEstrellaModelo(Base):
    __tablename__ = "material_estrella"
    __table_args__ = (
        CheckConstraint("posicion BETWEEN 1 AND 3", name="posicion_rango"),
        CheckConstraint("nombre <> ''", name="nombre_no_vacio"),
        CheckConstraint("tengo >= 0", name="tengo_no_negativo"),
        CheckConstraint("necesito >= 0", name="necesito_no_negativo"),
    )

    aniimo_del_team_id: Mapped[UUID] = mapped_column(
        ForeignKey("aniimo_del_team.id", ondelete="CASCADE"), primary_key=True
    )
    posicion: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50))
    tengo: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    necesito: Mapped[int] = mapped_column(Integer, server_default=text("0"))


class ObjetoTransportadoModelo(Base):
    __tablename__ = "objeto_transportado"
    __table_args__ = (
        CheckConstraint("nombre <> ''", name="nombre_no_vacio"),
        CheckConstraint("nivel >= 1", name="nivel_minimo"),
    )

    aniimo_del_team_id: Mapped[UUID] = mapped_column(
        ForeignKey("aniimo_del_team.id", ondelete="CASCADE"), primary_key=True
    )
    posicion: Mapped[PosicionObjeto] = mapped_column(
        _enum(PosicionObjeto, "posicion"), primary_key=True
    )
    nombre: Mapped[str] = mapped_column(String(50))
    rareza: Mapped[Rareza] = mapped_column(_enum(Rareza, "rareza"))
    nivel: Mapped[int] = mapped_column(SmallInteger, server_default=text("1"))
    contrato: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    efecto_nucleo_notas: Mapped[str | None] = mapped_column(Text)


class ImagenAniimoModelo(Base):
    __tablename__ = "imagen_aniimo"
    __table_args__ = (
        CheckConstraint(f"octet_length(datos) BETWEEN 1 AND {TAMANO_MAXIMO}", name="tamano"),
    )

    aniimo_del_team_id: Mapped[UUID] = mapped_column(
        ForeignKey("aniimo_del_team.id", ondelete="CASCADE"), primary_key=True
    )
    tipo: Mapped[TipoDeImagen] = mapped_column(
        _enum(TipoDeImagen, "tipo", longitud=_LONGITUD_TIPO_DE_IMAGEN)
    )
    datos: Mapped[bytes] = mapped_column(LargeBinary)
    actualizada_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
