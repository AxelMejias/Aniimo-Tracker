from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum

from app.domain.catalogos import Stat
from app.domain.crecimiento import (
    CambioConocido,
    Catalogo,
    Confianza,
    ObjetoDelCatalogo,
    ParametrosDePotencial,
    TipoDeModificador,
    bono_de_estrella,
    bono_de_objeto,
    secciones_sin_datos,
)

TOPE_DE_POTENCIAL = 20


class ViaDespertar(StrEnum):
    SI = "si"
    SIN_CUPO = "sin-cupo"
    TOPE = "tope"


class NotaDePotencialDeObjeto(StrEnum):
    SIN_ELEGIR = "sin-elegir"
    OBJETO_DESCONOCIDO = "objeto-desconocido"
    SIN_BONO_DE_POTENCIAL = "sin-bono-de-potencial"


@dataclass(frozen=True, slots=True)
class ObjetoEquipado:
    objeto_id: str | None
    nivel: int


@dataclass(frozen=True, slots=True)
class EntradaDePotencial:
    nivel: int
    etapa_estrella: int
    potenciales: Mapping[Stat, int]
    personalidad: str | None
    objeto_equipado: ObjetoEquipado | None
    despertares_usados: int
    despertares_total: int
    fecha_parche: date | None


@dataclass(frozen=True, slots=True)
class PotencialDeStat:
    potencial: int
    bono_estrella: int
    bono_objeto: int
    n: int
    saltos: int
    proximo_salto: int
    puntos_al_proximo: int
    porcentaje_por_puntos: Decimal
    porcentaje_por_saltos: Decimal
    via_despertar: ViaDespertar


@dataclass(frozen=True, slots=True)
class PotencialEfectivo:
    confianza: Confianza
    por_punto: Decimal
    salto_cada: int
    salto_porcentaje: Decimal
    cuenta_estrella: bool
    cuenta_objeto: bool
    stats: Mapping[Stat, PotencialDeStat]


@dataclass(frozen=True, slots=True)
class TramoDeCupo:
    origen: str
    detalle: str
    suma: int


@dataclass(frozen=True, slots=True)
class CupoDeDespertar:
    confianza: Confianza
    cupo_sugerido: int
    desglose: tuple[TramoDeCupo, ...]
    total_cargado: int
    diferencia: int
    restantes: int


@dataclass(frozen=True, slots=True)
class BonoDeLetra:
    stat: Stat | None
    descripcion: str
    porcentaje: Decimal


@dataclass(frozen=True, slots=True)
class SlotDePersonalidad:
    letra: str
    nombre: str | None
    letra_confirmada: bool
    confianza: Confianza | None
    bonos: tuple[BonoDeLetra, ...]


@dataclass(frozen=True, slots=True)
class ResultadoDeObjetoDePotencial:
    aplicado: bool
    nota: NotaDePotencialDeObjeto | None


@dataclass(frozen=True, slots=True)
class ResultadoDePotencial:
    potencial: PotencialEfectivo | None
    despertar: CupoDeDespertar | None
    personalidad: tuple[SlotDePersonalidad, ...] | None
    objeto: ResultadoDeObjetoDePotencial | None
    version_desconocida: bool
    avisos: tuple[CambioConocido, ...]
    sin_datos: tuple[str, ...]


def _objeto_del_catalogo(
    catalogo: Catalogo, equipado: ObjetoEquipado | None
) -> tuple[ResultadoDeObjetoDePotencial | None, ObjetoDelCatalogo | None]:
    if equipado is None:
        return None, None
    if equipado.objeto_id is None:
        return ResultadoDeObjetoDePotencial(False, NotaDePotencialDeObjeto.SIN_ELEGIR), None
    objeto = next((o for o in catalogo.objetos or () if o.id == equipado.objeto_id), None)
    if objeto is None:
        return ResultadoDeObjetoDePotencial(False, NotaDePotencialDeObjeto.OBJETO_DESCONOCIDO), None
    aporta = any(bono_de_objeto(catalogo, objeto, equipado.nivel, stat) > 0 for stat in Stat)
    if not aporta:
        sin_bono = NotaDePotencialDeObjeto.SIN_BONO_DE_POTENCIAL
        return ResultadoDeObjetoDePotencial(False, sin_bono), None
    return ResultadoDeObjetoDePotencial(True, None), objeto


def _via_despertar(potencial: int, faltan: int, restantes: int) -> ViaDespertar:
    if potencial + faltan > TOPE_DE_POTENCIAL:
        return ViaDespertar.TOPE
    if restantes < faltan:
        return ViaDespertar.SIN_CUPO
    return ViaDespertar.SI


def _potencial_de_stat(
    catalogo: Catalogo,
    parametros: ParametrosDePotencial,
    entrada: EntradaDePotencial,
    stat: Stat,
    objeto: ObjetoDelCatalogo | None,
) -> PotencialDeStat:
    potencial = entrada.potenciales[stat]
    estrella = bono_de_estrella(catalogo, entrada.etapa_estrella)
    del_objeto = 0
    if objeto is not None and entrada.objeto_equipado is not None:
        del_objeto = bono_de_objeto(catalogo, objeto, entrada.objeto_equipado.nivel, stat)
    n = potencial + estrella + del_objeto
    saltos = n // parametros.salto_cada
    proximo = (saltos + 1) * parametros.salto_cada
    faltan = proximo - n
    restantes = entrada.despertares_total - entrada.despertares_usados
    return PotencialDeStat(
        potencial=potencial,
        bono_estrella=estrella,
        bono_objeto=del_objeto,
        n=n,
        saltos=saltos,
        proximo_salto=proximo,
        puntos_al_proximo=faltan,
        porcentaje_por_puntos=parametros.por_punto * n,
        porcentaje_por_saltos=parametros.salto_porcentaje * saltos,
        via_despertar=_via_despertar(potencial, faltan, restantes),
    )


def _calcular_potencial(
    catalogo: Catalogo, entrada: EntradaDePotencial, objeto: ObjetoDelCatalogo | None
) -> PotencialEfectivo | None:
    parametros = catalogo.potencial
    if parametros is None:
        return None
    return PotencialEfectivo(
        confianza=parametros.confianza,
        por_punto=parametros.por_punto,
        salto_cada=parametros.salto_cada,
        salto_porcentaje=parametros.salto_porcentaje,
        cuenta_estrella=parametros.cuenta_estrella,
        cuenta_objeto=parametros.cuenta_objeto,
        stats={
            stat: _potencial_de_stat(catalogo, parametros, entrada, stat, objeto) for stat in Stat
        },
    )


def calcular_cupo_de_despertar(
    catalogo: Catalogo, nivel: int, etapa_estrella: int, usados: int, total: int
) -> CupoDeDespertar | None:
    despertar = catalogo.despertar
    if despertar is None:
        return None
    tramos = [
        TramoDeCupo("nivel", f"nivel {a.nivel}", a.suma)
        for a in despertar.aumentos_por_nivel
        if a.nivel <= nivel and a.suma > 0
    ]
    if catalogo.etapas_de_estrella is not None:
        tramos += [
            TramoDeCupo("etapa", f"etapa {e.etapa}", e.bono_cupo)
            for e in catalogo.etapas_de_estrella.etapas
            if e.etapa <= etapa_estrella and e.bono_cupo > 0
        ]
    sugerido = sum(t.suma for t in tramos)
    return CupoDeDespertar(
        confianza=despertar.confianza,
        cupo_sugerido=sugerido,
        desglose=tuple(tramos),
        total_cargado=total,
        diferencia=sugerido - total,
        restantes=total - usados,
    )


def desglosar_personalidad(
    catalogo: Catalogo, personalidad: str | None
) -> tuple[SlotDePersonalidad, ...] | None:
    if personalidad is None or catalogo.personalidad is None:
        return None
    slots: list[SlotDePersonalidad] = []
    for letra in personalidad:
        datos = catalogo.personalidad.get(letra)
        if datos is None:
            slots.append(SlotDePersonalidad(letra, None, False, None, ()))
            continue
        bonos = [
            BonoDeLetra(stat, stat.value, modificador.valor)
            for stat, modificadores in datos.modificadores.items()
            for modificador in modificadores
            if modificador.tipo is TipoDeModificador.PORCENTAJE
        ]
        bonos += [BonoDeLetra(None, o.descripcion, o.porcentaje) for o in datos.otros]
        slots.append(
            SlotDePersonalidad(
                letra, datos.nombre, datos.letra_confirmada, datos.confianza, tuple(bonos)
            )
        )
    return tuple(slots)


def avisos_de_version(
    catalogo: Catalogo, fecha_parche: date | None
) -> tuple[bool, tuple[CambioConocido, ...]]:
    if fecha_parche is None:
        return True, catalogo.cambios_conocidos
    return False, tuple(c for c in catalogo.cambios_conocidos if c.fecha > fecha_parche)


def calcular_potencial_efectivo(
    catalogo: Catalogo, entrada: EntradaDePotencial
) -> ResultadoDePotencial:
    resultado_objeto, objeto = _objeto_del_catalogo(catalogo, entrada.objeto_equipado)
    version_desconocida, avisos = avisos_de_version(catalogo, entrada.fecha_parche)
    return ResultadoDePotencial(
        potencial=_calcular_potencial(catalogo, entrada, objeto),
        despertar=calcular_cupo_de_despertar(
            catalogo,
            entrada.nivel,
            entrada.etapa_estrella,
            entrada.despertares_usados,
            entrada.despertares_total,
        ),
        personalidad=desglosar_personalidad(catalogo, entrada.personalidad),
        objeto=resultado_objeto,
        version_desconocida=version_desconocida,
        avisos=avisos,
        sin_datos=secciones_sin_datos(catalogo),
    )
