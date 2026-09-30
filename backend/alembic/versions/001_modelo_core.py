"""modelo core: usuario, team, aniimo_del_team, material_estrella, objeto_transportado

Revision ID: 001
Revises:
Create Date: 2026-09-30 03:25:20.898442

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre_usuario", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint("nombre_usuario <> ''", name=op.f("ck_usuario_nombre_usuario_no_vacio")),
        sa.CheckConstraint(
            "nombre_usuario = lower(nombre_usuario)",
            name=op.f("ck_usuario_nombre_usuario_minuscula"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usuario")),
        sa.UniqueConstraint("nombre_usuario", name=op.f("uq_usuario_nombre_usuario")),
    )
    op.create_table(
        "team",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("orden", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint("nombre <> ''", name=op.f("ck_team_nombre_no_vacio")),
        sa.CheckConstraint("orden BETWEEN 1 AND 4", name=op.f("ck_team_orden_rango")),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_team_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_team")),
        sa.UniqueConstraint("usuario_id", "orden", name=op.f("uq_team_usuario_id_orden")),
    )
    op.create_table(
        "aniimo_del_team",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("slot", sa.SmallInteger(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column(
            "elemento",
            sa.Enum(
                "fuego",
                "agua",
                "planta",
                "electrico",
                "hielo",
                "roca",
                "viento",
                "sagrado",
                "oscuro",
                name="elemento",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "rol",
            sa.Enum(
                "dps",
                "soporte",
                "sanador",
                "tanque",
                name="rol",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=True,
        ),
        sa.Column(
            "potencial_innato",
            sa.Enum(
                "comun",
                "bueno",
                "elite",
                "perfecto",
                name="potencial_innato",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=True,
        ),
        sa.Column("personalidad", sa.CHAR(length=4), nullable=True),
        sa.Column("nivel", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("cp", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "estrella_actual", sa.SmallInteger(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("nivel_requerido_siguiente_etapa", sa.Integer(), nullable=True),
        sa.Column("ganancia_despertar", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "ganancia_seis_potenciales", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("despertares_usados", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("despertares_total", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("notas_habilidades", sa.Text(), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("ps_valor", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("ps_potencial", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("ps_bono_estrellas", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("ps_notas", sa.Text(), nullable=True),
        sa.Column("atq_valor", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("atq_potencial", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("atq_bono_estrellas", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("atq_notas", sa.Text(), nullable=True),
        sa.Column("def_fisica_valor", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "def_fisica_potencial", sa.SmallInteger(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "def_fisica_bono_estrellas", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("def_fisica_notas", sa.Text(), nullable=True),
        sa.Column("def_magica_valor", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "def_magica_potencial", sa.SmallInteger(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "def_magica_bono_estrellas", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("def_magica_notas", sa.Text(), nullable=True),
        sa.Column("regen_valor", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "regen_potencial", sa.SmallInteger(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "regen_bono_estrellas", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("regen_notas", sa.Text(), nullable=True),
        sa.Column("quiebre_valor", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "quiebre_potencial", sa.SmallInteger(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "quiebre_bono_estrellas", sa.Integer(), server_default=sa.text("0"), nullable=False
        ),
        sa.Column("quiebre_notas", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "elemento IN ('fuego', 'agua', 'planta', 'electrico', 'hielo', 'roca', 'viento', "
            "'sagrado', 'oscuro')",
            name=op.f("ck_aniimo_del_team_elemento"),
        ),
        sa.CheckConstraint("nombre <> ''", name=op.f("ck_aniimo_del_team_nombre_no_vacio")),
        sa.CheckConstraint(
            "personalidad ~ '^[EI][NS][TF][JP]$'",
            name=op.f("ck_aniimo_del_team_personalidad_formato"),
        ),
        sa.CheckConstraint(
            "potencial_innato IN ('comun', 'bueno', 'elite', 'perfecto')",
            name=op.f("ck_aniimo_del_team_potencial_innato"),
        ),
        sa.CheckConstraint(
            "rol IN ('dps', 'soporte', 'sanador', 'tanque')", name=op.f("ck_aniimo_del_team_rol")
        ),
        sa.CheckConstraint(
            "atq_bono_estrellas >= 0",
            name=op.f("ck_aniimo_del_team_atq_bono_estrellas_no_negativo"),
        ),
        sa.CheckConstraint(
            "atq_potencial BETWEEN 0 AND 20", name=op.f("ck_aniimo_del_team_atq_potencial_rango")
        ),
        sa.CheckConstraint("atq_valor >= 0", name=op.f("ck_aniimo_del_team_atq_valor_no_negativo")),
        sa.CheckConstraint("cp >= 0", name=op.f("ck_aniimo_del_team_cp_no_negativo")),
        sa.CheckConstraint(
            "def_fisica_bono_estrellas >= 0",
            name=op.f("ck_aniimo_del_team_def_fisica_bono_estrellas_no_negativo"),
        ),
        sa.CheckConstraint(
            "def_fisica_potencial BETWEEN 0 AND 20",
            name=op.f("ck_aniimo_del_team_def_fisica_potencial_rango"),
        ),
        sa.CheckConstraint(
            "def_fisica_valor >= 0", name=op.f("ck_aniimo_del_team_def_fisica_valor_no_negativo")
        ),
        sa.CheckConstraint(
            "def_magica_bono_estrellas >= 0",
            name=op.f("ck_aniimo_del_team_def_magica_bono_estrellas_no_negativo"),
        ),
        sa.CheckConstraint(
            "def_magica_potencial BETWEEN 0 AND 20",
            name=op.f("ck_aniimo_del_team_def_magica_potencial_rango"),
        ),
        sa.CheckConstraint(
            "def_magica_valor >= 0", name=op.f("ck_aniimo_del_team_def_magica_valor_no_negativo")
        ),
        sa.CheckConstraint(
            "despertares_total >= 0", name=op.f("ck_aniimo_del_team_despertares_total_no_negativo")
        ),
        sa.CheckConstraint(
            "despertares_usados <= despertares_total",
            name=op.f("ck_aniimo_del_team_despertares_consistentes"),
        ),
        sa.CheckConstraint(
            "despertares_usados >= 0",
            name=op.f("ck_aniimo_del_team_despertares_usados_no_negativo"),
        ),
        sa.CheckConstraint(
            "estrella_actual >= 0", name=op.f("ck_aniimo_del_team_estrella_actual_no_negativa")
        ),
        sa.CheckConstraint(
            "ganancia_despertar >= 0",
            name=op.f("ck_aniimo_del_team_ganancia_despertar_no_negativa"),
        ),
        sa.CheckConstraint(
            "ganancia_seis_potenciales >= 0",
            name=op.f("ck_aniimo_del_team_ganancia_seis_potenciales_no_negativa"),
        ),
        sa.CheckConstraint("nivel >= 1", name=op.f("ck_aniimo_del_team_nivel_minimo")),
        sa.CheckConstraint(
            "nivel_requerido_siguiente_etapa >= 1",
            name=op.f("ck_aniimo_del_team_nivel_requerido_siguiente_etapa_minimo"),
        ),
        sa.CheckConstraint(
            "ps_bono_estrellas >= 0", name=op.f("ck_aniimo_del_team_ps_bono_estrellas_no_negativo")
        ),
        sa.CheckConstraint(
            "ps_potencial BETWEEN 0 AND 20", name=op.f("ck_aniimo_del_team_ps_potencial_rango")
        ),
        sa.CheckConstraint("ps_valor >= 0", name=op.f("ck_aniimo_del_team_ps_valor_no_negativo")),
        sa.CheckConstraint(
            "quiebre_bono_estrellas >= 0",
            name=op.f("ck_aniimo_del_team_quiebre_bono_estrellas_no_negativo"),
        ),
        sa.CheckConstraint(
            "quiebre_potencial BETWEEN 0 AND 20",
            name=op.f("ck_aniimo_del_team_quiebre_potencial_rango"),
        ),
        sa.CheckConstraint(
            "quiebre_valor >= 0", name=op.f("ck_aniimo_del_team_quiebre_valor_no_negativo")
        ),
        sa.CheckConstraint(
            "regen_bono_estrellas >= 0",
            name=op.f("ck_aniimo_del_team_regen_bono_estrellas_no_negativo"),
        ),
        sa.CheckConstraint(
            "regen_potencial BETWEEN 0 AND 20",
            name=op.f("ck_aniimo_del_team_regen_potencial_rango"),
        ),
        sa.CheckConstraint(
            "regen_valor >= 0", name=op.f("ck_aniimo_del_team_regen_valor_no_negativo")
        ),
        sa.CheckConstraint("slot BETWEEN 1 AND 4", name=op.f("ck_aniimo_del_team_slot_rango")),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["team.id"],
            name=op.f("fk_aniimo_del_team_team_id_team"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_aniimo_del_team")),
        sa.UniqueConstraint("team_id", "slot", name=op.f("uq_aniimo_del_team_team_id_slot")),
    )
    op.create_table(
        "material_estrella",
        sa.Column("aniimo_del_team_id", sa.Uuid(), nullable=False),
        sa.Column("posicion", sa.SmallInteger(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("tengo", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("necesito", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.CheckConstraint("nombre <> ''", name=op.f("ck_material_estrella_nombre_no_vacio")),
        sa.CheckConstraint("necesito >= 0", name=op.f("ck_material_estrella_necesito_no_negativo")),
        sa.CheckConstraint(
            "posicion BETWEEN 1 AND 3", name=op.f("ck_material_estrella_posicion_rango")
        ),
        sa.CheckConstraint("tengo >= 0", name=op.f("ck_material_estrella_tengo_no_negativo")),
        sa.ForeignKeyConstraint(
            ["aniimo_del_team_id"],
            ["aniimo_del_team.id"],
            name=op.f("fk_material_estrella_aniimo_del_team_id_aniimo_del_team"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "aniimo_del_team_id", "posicion", name=op.f("pk_material_estrella")
        ),
    )
    op.create_table(
        "objeto_transportado",
        sa.Column("aniimo_del_team_id", sa.Uuid(), nullable=False),
        sa.Column(
            "posicion",
            sa.Enum(
                "equipado",
                "alternativo",
                name="posicion",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column(
            "rareza",
            sa.Enum(
                "rara",
                "epica",
                "legendaria",
                name="rareza",
                native_enum=False,
                create_constraint=False,
            ),
            nullable=False,
        ),
        sa.Column("nivel", sa.SmallInteger(), server_default=sa.text("1"), nullable=False),
        sa.Column("contrato", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("efecto_nucleo_notas", sa.Text(), nullable=True),
        sa.CheckConstraint("nombre <> ''", name=op.f("ck_objeto_transportado_nombre_no_vacio")),
        sa.CheckConstraint(
            "posicion IN ('equipado', 'alternativo')", name=op.f("ck_objeto_transportado_posicion")
        ),
        sa.CheckConstraint(
            "rareza IN ('rara', 'epica', 'legendaria')", name=op.f("ck_objeto_transportado_rareza")
        ),
        sa.CheckConstraint("nivel >= 1", name=op.f("ck_objeto_transportado_nivel_minimo")),
        sa.ForeignKeyConstraint(
            ["aniimo_del_team_id"],
            ["aniimo_del_team.id"],
            name=op.f("fk_objeto_transportado_aniimo_del_team_id_aniimo_del_team"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "aniimo_del_team_id", "posicion", name=op.f("pk_objeto_transportado")
        ),
    )


def downgrade() -> None:
    op.drop_table("objeto_transportado")
    op.drop_table("material_estrella")
    op.drop_table("aniimo_del_team")
    op.drop_table("team")
    op.drop_table("usuario")
