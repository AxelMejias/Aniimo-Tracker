"""fecha_parche_y_etapa: fecha del parche del juego y etapa de estrella en la ficha

Revision ID: 006
Revises: 005
Create Date: 2026-10-26 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: str | Sequence[str] | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("aniimo_del_team", sa.Column("etapa_estrella", sa.SmallInteger(), nullable=True))
    op.add_column("aniimo_del_team", sa.Column("fecha_parche", sa.Date(), nullable=True))
    op.create_check_constraint(
        op.f("ck_aniimo_del_team_etapa_estrella_rango"),
        "aniimo_del_team",
        "etapa_estrella IS NULL OR etapa_estrella BETWEEN 0 AND 7",
    )
    op.create_check_constraint(
        op.f("ck_aniimo_del_team_fecha_parche_rango"),
        "aniimo_del_team",
        "fecha_parche IS NULL OR fecha_parche BETWEEN '2020-01-01' AND '2099-12-31'",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_aniimo_del_team_fecha_parche_rango"), "aniimo_del_team", type_="check"
    )
    op.drop_constraint(
        op.f("ck_aniimo_del_team_etapa_estrella_rango"), "aniimo_del_team", type_="check"
    )
    op.drop_column("aniimo_del_team", "fecha_parche")
    op.drop_column("aniimo_del_team", "etapa_estrella")
