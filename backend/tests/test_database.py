from sqlalchemy import text
from sqlalchemy.engine import Engine


def test_select_1_returns_1(test_engine: Engine) -> None:
    with test_engine.connect() as connection:
        result = connection.execute(text("SELECT 1")).scalar_one()
    assert result == 1
