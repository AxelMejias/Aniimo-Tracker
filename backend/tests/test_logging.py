import logging

from app.core.logging import configure_logging, describe_database_url


def test_describe_database_url_hides_credentials() -> None:
    url = "postgresql+psycopg://aniimo:cambiar-me@127.0.0.1:5432/aniimo"
    result = describe_database_url(url)
    assert result == "127.0.0.1:5432/aniimo"
    assert "aniimo:cambiar-me" not in result
    assert "cambiar-me" not in result


def test_describe_database_url_without_explicit_port() -> None:
    url = "postgresql+psycopg://user:pass@127.0.0.1/aniimo"
    result = describe_database_url(url)
    assert result == "127.0.0.1/aniimo"
    assert "user" not in result
    assert "pass" not in result


def test_describe_database_url_with_special_characters_in_password() -> None:
    url = "postgresql+psycopg://user:p@ss%23w0rd@127.0.0.1:5432/aniimo"
    result = describe_database_url(url)
    assert result == "127.0.0.1:5432/aniimo"
    assert "p@ss" not in result


def test_configure_logging_sets_app_logger_level() -> None:
    configure_logging("DEBUG")
    assert logging.getLogger("app").level == logging.DEBUG
