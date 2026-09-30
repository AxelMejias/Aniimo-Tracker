"""sesion: sesiones opacas de autenticacion

Revision ID: 002
Revises: 001
Create Date: 2026-09-30 07:01:50.479253

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | Sequence[str] | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sesion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("vence_en", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("expira_en <= vence_en", name=op.f("ck_sesion_expira_hasta_el_tope")),
        sa.CheckConstraint("vence_en > creada_en", name=op.f("ck_sesion_vence_despues_de_crear")),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_sesion_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sesion")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sesion_token_hash")),
    )
    op.create_index(op.f("ix_sesion_usuario_id"), "sesion", ["usuario_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sesion_usuario_id"), table_name="sesion")
    op.drop_table("sesion")
