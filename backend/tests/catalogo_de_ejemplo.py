from dataclasses import replace
from datetime import date
from decimal import Decimal

from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.crecimiento import (
    AumentoDeCupo,
    BonoDePotencialDeObjeto,
    CambioConocido,
    Catalogo,
    Confianza,
    EntradaDeCalculo,
    Especie,
    EtapaDeEstrella,
    EtapaDeEstrellaConBonos,
    EtapasDeEstrella,
    FormulaDeCp,
    Interpolacion,
    LetraDePersonalidad,
    Modificador,
    NivelDeObjeto,
    ObjetoDeLaEntrada,
    ObjetoDelCatalogo,
    OtroEfecto,
    ParametrosDeDespertar,
    ParametrosDePotencial,
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


def letra(
    nombre: str,
    modificadores: dict[Stat, tuple[Modificador, ...]] | None = None,
    otros: tuple[OtroEfecto, ...] = (),
    *,
    confirmada: bool = True,
) -> LetraDePersonalidad:
    return LetraDePersonalidad(
        nombre=nombre,
        letra_confirmada=confirmada,
        confianza=Confianza.MEDIDO,
        modificadores=modificadores or {},
        otros=otros,
    )


def personalidad_de_ejemplo() -> dict[str, LetraDePersonalidad]:
    return {
        "E": letra(
            "Energetic",
            {Stat.ATQ: (mod(PORCENTAJE, 2),), Stat.QUIEBRE: (mod(PORCENTAJE, 2),)},
        ),
        "I": letra("Instinctive", {Stat.REGEN: (mod(PORCENTAJE, 4),)}, confirmada=False),
        "N": letra("Nimble", otros=(OtroEfecto("Prob. de crítico", Decimal(5)),)),
        "F": letra("Faithful", {Stat.DEF_MAGICA: (mod(PORCENTAJE, 6),)}, confirmada=False),
        "J": letra("Judicious", {Stat.PS: (mod(PORCENTAJE, 4),)}, confirmada=False),
    }


def parametros_de_potencial(**cambios: object) -> ParametrosDePotencial:
    parametros = ParametrosDePotencial(
        confianza=Confianza.MEDIDO,
        por_punto=Decimal("0.8"),
        salto_cada=4,
        salto_porcentaje=Decimal(4),
        cuenta_estrella=True,
        cuenta_objeto=True,
    )
    return replace(parametros, **cambios)  # type: ignore[arg-type]


def catalogo_de_ejemplo(**cambios: object) -> Catalogo:
    catalogo = Catalogo(
        formato=2,
        version="ejemplo-2",
        es_ejemplo=True,
        estimacion_verificada=False,
        fecha_parche=date(2026, 9, 23),
        cambios_conocidos=(
            CambioConocido(date(2026, 9, 23), "Actualizacion del 23/09", Confianza.FAN),
        ),
        redondeo=Redondeo.ABAJO,
        interpolacion=Interpolacion.LINEAL,
        especies=(
            Especie(id="ejemplo-a", nombre="EJEMPLO Aniimo A", base=base_de_ejemplo()),
            Especie(id="ejemplo-b", nombre="EJEMPLO Aniimo B", base=base_de_ejemplo()),
        ),
        potencial=parametros_de_potencial(),
        etapas_de_estrella=EtapasDeEstrella(
            Confianza.MEDIDO,
            (
                EtapaDeEstrellaConBonos(etapa=5, bono_potencial=1, bono_cupo=5),
                EtapaDeEstrellaConBonos(etapa=6, bono_potencial=1, bono_cupo=8),
                EtapaDeEstrellaConBonos(etapa=7, bono_potencial=2, bono_cupo=10),
            ),
        ),
        despertar=ParametrosDeDespertar(
            Confianza.MEDIDO,
            (
                AumentoDeCupo(nivel=1, suma=5),
                AumentoDeCupo(nivel=45, suma=5),
                AumentoDeCupo(nivel=55, suma=10),
                AumentoDeCupo(nivel=60, suma=10),
            ),
        ),
        estrellas=(
            EtapaDeEstrella(etapa=1, modificadores={Stat.ATQ: (mod(PLANO, 10),)}),
            EtapaDeEstrella(
                etapa=2,
                modificadores={Stat.ATQ: (mod(PLANO, 20),), Stat.PS: (mod(PLANO, 100),)},
            ),
        ),
        personalidad=personalidad_de_ejemplo(),
        objetos=(
            ObjetoDelCatalogo(
                id="ejemplo-objeto-x",
                nombre="EJEMPLO Objeto X",
                niveles=(
                    NivelDeObjeto(
                        nivel=1,
                        modificadores={Stat.ATQ: (mod(PORCENTAJE, 10), mod(PLANO, 5))},
                    ),
                    NivelDeObjeto(
                        nivel=2,
                        modificadores={Stat.ATQ: (mod(PORCENTAJE, 12), mod(PLANO, 8))},
                    ),
                ),
                bono_potencial=BonoDePotencialDeObjeto(desde_nivel=2, stats={Stat.ATQ: 2}),
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
    etapa_estrella: int = 0,
    personalidad: str | None = None,
    objetos: tuple[ObjetoDeLaEntrada, ...] = (),
    **puntos: int,
) -> EntradaDeCalculo:
    return EntradaDeCalculo(
        especie_id=especie_id,
        nivel=nivel,
        potenciales=potenciales(**puntos),
        etapa_estrella=etapa_estrella,
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
