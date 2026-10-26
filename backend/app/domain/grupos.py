from collections.abc import Collection, Sequence
from uuid import UUID

from app.domain.errores import OrdenDesactualizado


def portada_efectiva_de_team(
    portada_slot: int | None, slots_ocupados: Collection[int]
) -> int | None:
    if portada_slot is not None and portada_slot in slots_ocupados:
        return portada_slot
    return min(slots_ocupados, default=None)


def portada_efectiva_de_grupo(
    portada_team_id: UUID | None, team_ids_en_orden: Sequence[UUID]
) -> UUID | None:
    if portada_team_id is not None and portada_team_id in team_ids_en_orden:
        return portada_team_id
    return team_ids_en_orden[0] if team_ids_en_orden else None


def repartir_orden(actual: dict[UUID, int], pedido: Sequence[UUID]) -> dict[UUID, int]:
    if len(pedido) != len(actual) or set(pedido) != set(actual):
        raise OrdenDesactualizado
    return dict(zip(pedido, sorted(actual.values()), strict=True))
