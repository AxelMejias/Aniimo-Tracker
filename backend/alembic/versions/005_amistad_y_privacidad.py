"""amistad_y_privacidad: amistades entre usuarios y controles de privacidad del dueño

Revision ID: 005
Revises: 004
Create Date: 2026-10-25 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: str | Sequence[str] | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "amistad",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_a_id", sa.Uuid(), nullable=False),
        sa.Column("usuario_b_id", sa.Uuid(), nullable=False),
        sa.Column("solicitante_id", sa.Uuid(), nullable=False),
        sa.Column(
            "estado",
            sa.Enum(
                "pendiente",
                "aceptada",
                name="estado",
                native_enum=False,
                create_constraint=False,
                length=9,
            ),
            nullable=False,
        ),
        sa.Column(
            "creada_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("aceptada_en", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("usuario_a_id < usuario_b_id", name=op.f("ck_amistad_par_ordenado")),
        sa.CheckConstraint(
            "solicitante_id IN (usuario_a_id, usuario_b_id)",
            name=op.f("ck_amistad_solicitante_en_par"),
        ),
        sa.CheckConstraint("estado IN ('pendiente', 'aceptada')", name=op.f("ck_amistad_estado")),
        sa.CheckConstraint(
            "(estado = 'aceptada') = (aceptada_en IS NOT NULL)",
            name=op.f("ck_amistad_aceptada_en_coherente"),
        ),
        sa.ForeignKeyConstraint(
            ["usuario_a_id"],
            ["usuario.id"],
            name=op.f("fk_amistad_usuario_a_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_b_id"],
            ["usuario.id"],
            name=op.f("fk_amistad_usuario_b_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_amistad")),
        sa.UniqueConstraint(
            "usuario_a_id", "usuario_b_id", name=op.f("uq_amistad_usuario_a_id_usuario_b_id")
        ),
    )
    op.create_index(op.f("ix_amistad_usuario_b_id"), "amistad", ["usuario_b_id"], unique=False)
    op.add_column(
        "team",
        sa.Column(
            "oculto_para_amigos", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
    )
    op.add_column(
        "aniimo_del_team",
        sa.Column("notas_privadas", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("aniimo_del_team", "notas_privadas")
    op.drop_column("team", "oculto_para_amigos")
    op.drop_index(op.f("ix_amistad_usuario_b_id"), table_name="amistad")
    op.drop_table("amistad")
