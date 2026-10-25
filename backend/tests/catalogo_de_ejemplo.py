from dataclasses import replace
from decimal import Decimal

from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    Catalogo,
    EntradaDeCalculo,
    Especie,
    EtapaDeEstrella,
    FormulaDeCp,
    Interpolacion,
    Modificador,
    NivelDeObjeto,
    ObjetoDeLaEntrada,
    ObjetoDelCatalogo,
    PuntoMedido,
    Redondeo,
    TipoDeModificador,
)

PORCENTAJE = TipoDeModificador.PORCENTAJE
PLANO = TipoDeModificador.PLANO


def mod(tipo: TipoDeModificador, valor: str | int) -> Modificador:
    return Modificador(tipo=tipo, valor=Decimal(str(valor)))


def _curva(inicio: int, fin: int) -> tuple[PuntoMedido, ...]:
    return (PuntoMedido(1, inicio), PuntoMedido(60, fin))


def base_de_ejemplo() -> dict[Stat, tuple[PuntoMedido, ...]]:
    return {
        Stat.PS: _curva(1000, 6900),
        Stat.ATQ: _curva(100, 690),
        Stat.DEF_FISICA: _curva(50, 340),
        Stat.DEF_MAGICA: _curva(60, 350),
        Stat.REGEN: _curva(70, 360),
        Stat.QUIEBRE: _curva(80, 370),
    }


def catalogo_de_ejemplo(**cambios: object) -> Catalogo:
    catalogo = Catalogo(
        version="ejemplo-1",
        es_ejemplo=True,
        redondeo=Redondeo.ABAJO,
        interpolacion=Interpolacion.LINEAL,
        especies=(
            Especie(id="ejemplo-a", nombre="EJEMPLO Aniimo A", base=base_de_ejemplo()),
            Especie(id="ejemplo-b", nombre="EJEMPLO Aniimo B", base=base_de_ejemplo()),
        ),
        potencial={Stat.ATQ: mod(PORCENTAJE, 1), Stat.PS: mod(PLANO, 10)},
        estrellas=(
            EtapaDeEstrella(estrella=1, modificadores={Stat.ATQ: (mod(PLANO, 10),)}),
            EtapaDeEstrella(estrella=2, modificadores={Stat.ATQ: (mod(PLANO, 20),)}),
        ),
        personalidad={
            "E": {Stat.ATQ: (mod(PORCENTAJE, 5),)},
            "N": {Stat.PS: (mod(PLANO, 7),)},
        },
        objetos=(
            ObjetoDelCatalogo(
                id="ejemplo-objeto-x",
                nombre="EJEMPLO Objeto X",
                niveles=(
                    NivelDeObjeto(
                        nivel=1,
                        modificadores={Stat.ATQ: (mod(PORCENTAJE, 10), mod(PLANO, 5))},
                    ),
                ),
            ),
            ObjetoDelCatalogo(
                id="ejemplo-objeto-y",
                nombre="EJEMPLO Objeto Y",
                niveles=(
                    NivelDeObjeto(nivel=1, modificadores={Stat.PS: (mod(PLANO, 50),)}),
                    NivelDeObjeto(nivel=2, modificadores={Stat.DEF_FISICA: (mod(PORCENTAJE, 4),)}),
                ),
            ),
        ),
        cp=FormulaDeCp(
            constante=Decimal(100), pesos={Stat.ATQ: Decimal(1)}, por_punto_de_potencial=Decimal(2)
        ),
    )
    return replace(catalogo, **cambios)  # type: ignore[arg-type]


def potenciales(**puntos: int) -> dict[Stat, int]:
    return {stat: puntos.get(stat.value, 0) for stat in Stat}


def entrada(
    *,
    especie_id: str = "ejemplo-a",
    nivel: int = 60,
    estrella_actual: int = 0,
    personalidad: str | None = None,
    objetos: tuple[ObjetoDeLaEntrada, ...] = (),
    **puntos: int,
) -> EntradaDeCalculo:
    return EntradaDeCalculo(
        especie_id=especie_id,
        nivel=nivel,
        potenciales=potenciales(**puntos),
        estrella_actual=estrella_actual,
        personalidad=personalidad,
        objetos=objetos,
    )


def objeto_equipado(
    objeto_id: str | None = "ejemplo-objeto-x", nivel: int = 1
) -> ObjetoDeLaEntrada:
    return ObjetoDeLaEntrada(posicion=PosicionObjeto.EQUIPADO, objeto_id=objeto_id, nivel=nivel)


def objeto_alternativo(
    objeto_id: str | None = "ejemplo-objeto-x", nivel: int = 1
) -> ObjetoDeLaEntrada:
    return ObjetoDeLaEntrada(posicion=PosicionObjeto.ALTERNATIVO, objeto_id=objeto_id, nivel=nivel)
