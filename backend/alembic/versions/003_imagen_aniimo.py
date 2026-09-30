"""imagen_aniimo: imagen del aniimo pegada por el usuario

Revision ID: 003
Revises: 002
Create Date: 2026-09-30 08:18:30.028517

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: str | Sequence[str] | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "imagen_aniimo",
        sa.Column("aniimo_del_team_id", sa.Uuid(), nullable=False),
        sa.Column(
            "tipo",
            sa.Enum(
                "image/png",
                "image/jpeg",
                "image/webp",
                name="tipo",
                native_enum=False,
                create_constraint=False,
                length=32,
            ),
            nullable=False,
        ),
        sa.Column("datos", sa.LargeBinary(), nullable=False),
        sa.Column(
            "actualizada_en",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "tipo IN ('image/png', 'image/jpeg', 'image/webp')",
            name=op.f("ck_imagen_aniimo_tipo"),
        ),
        sa.CheckConstraint(
            "octet_length(datos) BETWEEN 1 AND 1048576", name=op.f("ck_imagen_aniimo_tamano")
        ),
        sa.ForeignKeyConstraint(
            ["aniimo_del_team_id"],
            ["aniimo_del_team.id"],
            name=op.f("fk_imagen_aniimo_aniimo_del_team_id_aniimo_del_team"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("aniimo_del_team_id", name=op.f("pk_imagen_aniimo")),
    )


def downgrade() -> None:
    op.drop_table("imagen_aniimo")
