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
