"""grupos_y_portadas: grupos de teams, portada del team y hasta 20 teams por usuario

Revision ID: 007
Revises: 006
Create Date: 2026-10-26 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007"
down_revision: str | Sequence[str] | None = "006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_team_orden_rango"), "team", type_="check")
    op.create_check_constraint(op.f("ck_team_orden_rango"), "team", "orden BETWEEN 1 AND 20")
    op.drop_constraint(op.f("uq_team_usuario_id_orden"), "team", type_="unique")
    op.create_unique_constraint(
        op.f("uq_team_usuario_id_orden"),
        "team",
        ["usuario_id", "orden"],
        deferrable=True,
        initially="IMMEDIATE",
    )
    op.create_unique_constraint(op.f("uq_team_usuario_id_id"), "team", ["usuario_id", "id"])

    op.create_table(
        "grupo_de_teams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("orden", sa.SmallInteger(), nullable=False),
        sa.Column("portada_team_id", sa.Uuid(), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.CheckConstraint("nombre <> ''", name=op.f("ck_grupo_de_teams_nombre_no_vacio")),
        sa.CheckConstraint("orden BETWEEN 1 AND 4", name=op.f("ck_grupo_de_teams_orden_rango")),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
            name=op.f("fk_grupo_de_teams_usuario_id_usuario"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_grupo_de_teams")),
        sa.UniqueConstraint(
            "usuario_id",
            "orden",
            name=op.f("uq_grupo_de_teams_usuario_id_orden"),
            deferrable=True,
            initially="IMMEDIATE",
        ),
        sa.UniqueConstraint("usuario_id", "id", name=op.f("uq_grupo_de_teams_usuario_id_id")),
    )

    op.add_column("team", sa.Column("grupo_id", sa.Uuid(), nullable=True))
    op.add_column("team", sa.Column("portada_slot", sa.SmallInteger(), nullable=True))
    op.create_check_constraint(
        op.f("ck_team_portada_slot_rango"),
        "team",
        "portada_slot IS NULL OR portada_slot BETWEEN 1 AND 4",
    )
    op.create_index(op.f("ix_team_grupo_id"), "team", ["grupo_id"])
    op.create_foreign_key(
        op.f("fk_team_usuario_id_grupo_de_teams"),
        "team",
        "grupo_de_teams",
        ["usuario_id", "grupo_id"],
        ["usuario_id", "id"],
        ondelete="SET NULL (grupo_id)",
    )
    op.create_foreign_key(
        op.f("fk_grupo_de_teams_usuario_id_team"),
        "grupo_de_teams",
        "team",
        ["usuario_id", "portada_team_id"],
        ["usuario_id", "id"],
        ondelete="SET NULL (portada_team_id)",
    )


def downgrade() -> None:
    sobrantes = op.get_bind().execute(sa.text("SELECT count(*) FROM team WHERE orden > 4"))
    if sobrantes.scalar_one():
        raise RuntimeError(
            "No se puede volver a 006: hay usuarios con más de 4 teams. "
            "Borrá los teams con orden mayor a 4 o restaurá un backup antes del downgrade."
        )
    op.drop_constraint(
        op.f("fk_grupo_de_teams_usuario_id_team"), "grupo_de_teams", type_="foreignkey"
    )
    op.drop_constraint(op.f("fk_team_usuario_id_grupo_de_teams"), "team", type_="foreignkey")
    op.drop_index(op.f("ix_team_grupo_id"), table_name="team")
    op.drop_constraint(op.f("ck_team_portada_slot_rango"), "team", type_="check")
    op.drop_column("team", "portada_slot")
    op.drop_column("team", "grupo_id")
    op.drop_table("grupo_de_teams")

    op.drop_constraint(op.f("uq_team_usuario_id_id"), "team", type_="unique")
    op.drop_constraint(op.f("uq_team_usuario_id_orden"), "team", type_="unique")
    op.create_unique_constraint(op.f("uq_team_usuario_id_orden"), "team", ["usuario_id", "orden"])
    op.drop_constraint(op.f("ck_team_orden_rango"), "team", type_="check")
    op.create_check_constraint(op.f("ck_team_orden_rango"), "team", "orden BETWEEN 1 AND 4")
