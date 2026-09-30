"""roles_del_juego: catalogo de roles verificado en el juego

Revision ID: 004
Revises: 003
Create Date: 2026-09-30 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | Sequence[str] | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CHECK_ROL = op.f("ck_aniimo_del_team_rol")


def upgrade() -> None:
    op.drop_constraint(CHECK_ROL, "aniimo_del_team", type_="check")
    op.alter_column(
        "aniimo_del_team",
        "rol",
        existing_type=sa.String(length=7),
        type_=sa.String(length=8),
        existing_nullable=True,
    )
    op.execute(
        "UPDATE aniimo_del_team SET rol = CASE rol "
        "WHEN 'soporte' THEN 'ayuda' WHEN 'sanador' THEN 'curacion' "
        "WHEN 'tanque' THEN NULL ELSE rol END"
    )
    op.create_check_constraint(
        CHECK_ROL,
        "aniimo_del_team",
        "rol IN ('dps', 'ayuda', 'curacion', 'regen', 'break')",
    )


def downgrade() -> None:
    op.drop_constraint(CHECK_ROL, "aniimo_del_team", type_="check")
    op.execute(
        "UPDATE aniimo_del_team SET rol = CASE rol "
        "WHEN 'ayuda' THEN 'soporte' WHEN 'curacion' THEN 'sanador' "
        "WHEN 'regen' THEN NULL WHEN 'break' THEN NULL ELSE rol END"
    )
    op.alter_column(
        "aniimo_del_team",
        "rol",
        existing_type=sa.String(length=8),
        type_=sa.String(length=7),
        existing_nullable=True,
    )
    op.create_check_constraint(
        CHECK_ROL,
        "aniimo_del_team",
        "rol IN ('dps', 'soporte', 'sanador', 'tanque')",
    )
