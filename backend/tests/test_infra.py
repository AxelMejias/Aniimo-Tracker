from pathlib import Path

import yaml

COMPOSE_PATH = Path(__file__).resolve().parents[2] / "docker-compose.yml"


def _load_compose() -> dict:
    return yaml.safe_load(COMPOSE_PATH.read_text(encoding="utf-8"))


def test_all_published_ports_bind_to_loopback() -> None:
    compose = _load_compose()
    services = compose["services"]
    assert services, "docker-compose.yml no define servicios"
    for name, service in services.items():
        for port_entry in service.get("ports", []):
            assert str(port_entry).startswith("127.0.0.1:"), (
                f"El servicio {name} publica un puerto sin atar a 127.0.0.1: {port_entry}"
            )


def test_no_port_exposed_without_explicit_host() -> None:
    compose = _load_compose()
    services = compose["services"]
    for name, service in services.items():
        for port_entry in service.get("ports", []):
            text = str(port_entry)
            assert "0.0.0.0" not in text, f"El servicio {name} expone un puerto a 0.0.0.0: {text}"  # noqa: S104
            assert text.count(":") >= 2, (
                f"El servicio {name} publica un puerto sin host explícito: {text}"
            )


COMPOSE_APP_PATH = Path(__file__).resolve().parents[2] / "docker-compose.app.yml"


def _load_compose_app() -> dict:
    return yaml.safe_load(COMPOSE_APP_PATH.read_text(encoding="utf-8"))


def test_compose_de_la_app_tiene_solo_db() -> None:
    assert set(_load_compose_app()["services"]) == {"db"}


def test_compose_de_la_app_publica_solo_en_loopback_el_5436() -> None:
    puertos = _load_compose_app()["services"]["db"]["ports"]
    assert puertos == ["127.0.0.1:5436:5432"]
    for entrada in puertos:
        assert "0.0.0.0" not in str(entrada)  # noqa: S104


def test_compose_de_la_app_exige_la_contrasena() -> None:
    entorno = _load_compose_app()["services"]["db"]["environment"]
    assert entorno["POSTGRES_PASSWORD"].startswith("${POSTGRES_PASSWORD:?")


def test_compose_de_la_app_usa_su_propio_volumen_y_la_imagen_fijada() -> None:
    compose = _load_compose_app()
    db = compose["services"]["db"]
    assert db["image"] == "postgres:16.4-alpine"
    assert db["volumes"] == ["aniimo-app-db-data:/var/lib/postgresql/data"]
    assert set(compose["volumes"]) == {"aniimo-app-db-data"}
