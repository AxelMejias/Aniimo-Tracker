from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _dependency_lines(path: Path) -> list[str]:
    lines = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("-r "):
            continue
        lines.append(line)
    return lines


def test_requirements_pin_exact_versions() -> None:
    lines = _dependency_lines(BACKEND_DIR / "requirements.txt")
    assert lines, "requirements.txt no tiene dependencias"
    for line in lines:
        assert "==" in line, f"Dependencia sin versión exacta: {line}"


def test_requirements_dev_pin_exact_versions() -> None:
    lines = _dependency_lines(BACKEND_DIR / "requirements-dev.txt")
    assert lines, "requirements-dev.txt no tiene dependencias"
    for line in lines:
        assert "==" in line, f"Dependencia sin versión exacta: {line}"
