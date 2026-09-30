import pytest

from app.domain.catalogos import Elemento, PosicionObjeto, PotencialInnato, Rareza, Rol, Stat

CATALOGOS = {
    Elemento: [
        "fuego",
        "agua",
        "planta",
        "electrico",
        "hielo",
        "roca",
        "viento",
        "sagrado",
        "oscuro",
    ],
    Rol: ["dps", "ayuda", "curacion", "regen", "break"],
    PotencialInnato: ["comun", "bueno", "elite", "perfecto"],
    Rareza: ["rara", "epica", "legendaria"],
    PosicionObjeto: ["equipado", "alternativo"],
    Stat: ["ps", "atq", "def_fisica", "def_magica", "regen", "quiebre"],
}


@pytest.mark.parametrize(("catalogo", "valores"), CATALOGOS.items())
def test_catalogo_tiene_exactamente_los_valores_de_la_kb(
    catalogo: type, valores: list[str]
) -> None:
    assert [miembro.value for miembro in catalogo] == valores


@pytest.mark.parametrize(("catalogo", "valores"), CATALOGOS.items())
def test_los_codigos_son_ascii_en_minuscula(catalogo: type, valores: list[str]) -> None:
    for miembro in catalogo:
        assert miembro.value.isascii()
        assert miembro.value == miembro.value.lower()


def test_el_catalogo_se_construye_desde_su_codigo() -> None:
    assert Elemento("electrico") is Elemento.ELECTRICO
    assert Rareza("legendaria") is Rareza.LEGENDARIA


def test_un_valor_fuera_del_catalogo_falla() -> None:
    with pytest.raises(ValueError):
        Elemento("metal")
