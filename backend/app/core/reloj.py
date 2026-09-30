from datetime import UTC, datetime


def ahora_utc() -> datetime:
    return datetime.now(UTC)
