from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, Decimal
from enum import StrEnum

from app.domain.catalogos import PosicionObjeto, Stat
from app.domain.errores import EspecieDesconocida

_CIEN = Decimal(100)


class TipoDeModificador(StrEnum):
    PORCENTAJE = "porcentaje"
    PLANO = "plano"


class Redondeo(StrEnum):
    ABAJO = "abajo"
    CERCANO = "cercano"
    ARRIBA = "arriba"


class Interpolacion(StrEnum):
    NINGUNA = "ninguna"
    LINEAL = "lineal"


class Confianza(StrEnum):
    OFICIAL = "oficial"
    MEDIDO = "medido"
    FAN = "fan"
    INFERIDO = "inferido"
    CONTRADICTORIO = "contradictorio"
    EJEMPLO = "ejemplo"


class TipoDeTermino(StrEnum):
    BASE = "base"
    PORCENTAJE = "porcentaje"
    PLANO = "plano"
    PESO = "peso"
    PUNTOS = "puntos"


class MotivoDeValor(StrEnum):
    FUERA_DE_RANGO = "fuera-de-rango"
    NIVEL_NO_MEDIDO = "nivel-no-medido"
    RESULTADO_INVALIDO = "resultado-invalido"
    SIN_DATOS = "sin-datos"
    STATS_INCOMPLETOS = "stats-incompletos"


class NotaDeObjeto(StrEnum):
    SIN_ELEGIR = "sin-elegir"
    OBJETO_DESCONOCIDO = "objeto-desconocido"
    NIVEL_DE_OBJETO_SIN_DATOS = "nivel-de-objeto-sin-datos"
    ALTERNATIVO_NO_SUMA = "alternativo-no-suma"


class Seccion(StrEnum):
    POTENCIAL = "potencial"
    ETAPAS_DE_ESTRELLA = "etapas_de_estrella"
    DESPERTAR = "despertar"
    ESTRELLAS = "estrellas"
    PERSONALIDAD = "personalidad"
    OBJETOS = "objetos"
    CP = "cp"


@dataclass(frozen=True, slots=True)
class Modificador:
    tipo: TipoDeModificador
    valor: Decimal


ModificadoresPorStat = Mapping[Stat, tuple[Modificador, ...]]


@dataclass(frozen=True, slots=True)
class PuntoMedido:
    nivel: int
    valor: int


@dataclass(frozen=True, slots=True)
class Especie:
    id: str
    nombre: str
    base: Mapping[Stat, tuple[PuntoMedido, ...]]


@dataclass(frozen=True, slots=True)
class EtapaDeEstrella:
    etapa: int
    modificadores: ModificadoresPorStat


@dataclass(frozen=True, slots=True)
class ParametrosDePotencial:
    confianza: Confianza
    por_punto: Decimal
    salto_cada: int
    salto_porcentaje: Decimal
    cuenta_estrella: bool
    cuenta_objeto: bool


@dataclass(frozen=True, slots=True)
class EtapaDeEstrellaConBonos:
    etapa: int
    bono_potencial: int
    bono_cupo: int


@dataclass(frozen=True, slots=True)
class EtapasDeEstrella:
    confianza: Confianza
    etapas: tuple[EtapaDeEstrellaConBonos, ...]


@dataclass(frozen=True, slots=True)
class AumentoDeCupo:
    nivel: int
    suma: int


@dataclass(frozen=True, slots=True)
class ParametrosDeDespertar:
    confianza: Confianza
    aumentos_por_nivel: tuple[AumentoDeCupo, ...]


@dataclass(frozen=True, slots=True)
class OtroEfecto:
    descripcion: str
    porcentaje: Decimal


@dataclass(frozen=True, slots=True)
class LetraDePersonalidad:
    nombre: str
    letra_confirmada: bool
    confianza: Confianza
    modificadores: ModificadoresPorStat
    otros: tuple[OtroEfecto, ...]


@dataclass(frozen=True, slots=True)
class CambioConocido:
    fecha: date
    descripcion: str
    confianza: Confianza


@dataclass(frozen=True, slots=True)
class BonoDePotencialDeObjeto:
    desde_nivel: int
    stats: Mapping[Stat, int]


@dataclass(frozen=True, slots=True)
class NivelDeObjeto:
    nivel: int
    modificadores: ModificadoresPorStat


@dataclass(frozen=True, slots=True)
class ObjetoDelCatalogo:
    id: str
    nombre: str
    niveles: tuple[NivelDeObjeto, ...]
    bono_potencial: BonoDePotencialDeObjeto | None = None


@dataclass(frozen=True, slots=True)
class FormulaDeCp:
    constante: Decimal
    pesos: Mapping[Stat, Decimal]
    por_punto_de_potencial: Decimal | None


@dataclass(frozen=True, slots=True)
class Catalogo:
    formato: int
    version: str
    es_ejemplo: bool
    estimacion_verificada: bool
    fecha_parche: date
    cambios_conocidos: tuple[CambioConocido, ...]
    redondeo: Redondeo
    interpolacion: Interpolacion
    especies: tuple[Especie, ...]
    potencial: ParametrosDePotencial | None
    etapas_de_estrella: EtapasDeEstrella | None
    despertar: ParametrosDeDespertar | None
    estrellas: tuple[EtapaDeEstrella, ...] | None
    personalidad: Mapping[str, LetraDePersonalidad] | None
    objetos: tuple[ObjetoDelCatalogo, ...] | None
    cp: FormulaDeCp | None


@dataclass(frozen=True, slots=True)
class ObjetoDeLaEntrada:
    posicion: PosicionObjeto
    objeto_id: str | None
    nivel: int


@dataclass(frozen=True, slots=True)
class EntradaDeCalculo:
    especie_id: str
    nivel: int
    potenciales: Mapping[Stat, int]
    etapa_estrella: int
    personalidad: str | None
    objetos: tuple[ObjetoDeLaEntrada, ...]


@dataclass(frozen=True, slots=True)
class TerminoDeDesglose:
    origen: str
    detalle: str
    tipo: TipoDeTermino
    valor: Decimal


@dataclass(frozen=True, slots=True)
class SugerenciaDeValor:
    valor: int | None
    valor_con_objetos: int | None
    aproximado: bool
    motivo: MotivoDeValor | None
    desglose: tuple[TerminoDeDesglose, ...]


@dataclass(frozen=True, slots=True)
class ResultadoDeObjeto:
    posicion: PosicionObjeto
    aplicado: bool
    nota: NotaDeObjeto | None


@dataclass(frozen=True, slots=True)
class Sugerencia:
    stats: Mapping[Stat, SugerenciaDeValor]
    cp: SugerenciaDeValor
    objetos: tuple[ResultadoDeObjeto, ...]
    sin_datos: tuple[str, ...]


@dataclass(slots=True)
class _Acumulado:
    porcentaje: Decimal
    plano: Decimal
    desglose: list[TerminoDeDesglose]

    def sumar(self, origen: str, detalle: str, modificador: Modificador, veces: int = 1) -> None:
        valor = modificador.valor * veces
        if modificador.tipo is TipoDeModificador.PORCENTAJE:
            self.porcentaje += valor
        else:
            self.plano += valor
        self.desglose.append(
            TerminoDeDesglose(origen, detalle, TipoDeTermino(modificador.tipo.value), valor)
        )

    def aplicar_a(self, valor: Decimal) -> Decimal:
        return valor * (1 + self.porcentaje / _CIEN) + self.plano


def _redondear(valor: Decimal, redondeo: Redondeo) -> int:
    modo = {
        Redondeo.ABAJO: ROUND_FLOOR,
        Redondeo.CERCANO: ROUND_HALF_UP,
        Redondeo.ARRIBA: ROUND_CEILING,
    }[redondeo]
    return int(valor.to_integral_value(rounding=modo))


def _base_en_el_nivel(
    puntos: tuple[PuntoMedido, ...], nivel: int, interpolacion: Interpolacion
) -> tuple[Decimal, bool] | MotivoDeValor:
    if nivel < puntos[0].nivel or nivel > puntos[-1].nivel:
        return MotivoDeValor.FUERA_DE_RANGO
    for anterior, siguiente in zip(puntos, puntos[1:], strict=False):
        if anterior.nivel == nivel:
            return Decimal(anterior.valor), False
        if anterior.nivel < nivel < siguiente.nivel:
            if interpolacion is Interpolacion.NINGUNA:
                return MotivoDeValor.NIVEL_NO_MEDIDO
            subida = Decimal((siguiente.valor - anterior.valor) * (nivel - anterior.nivel))
            tramo = Decimal(siguiente.nivel - anterior.nivel)
            return Decimal(anterior.valor) + subida / tramo, True
    return Decimal(puntos[-1].valor), False


def multiplicador_de_potencial(n: int, parametros: ParametrosDePotencial) -> Decimal:
    saltos = n // parametros.salto_cada
    por_puntos = 1 + parametros.por_punto * n / _CIEN
    por_saltos = 1 + parametros.salto_porcentaje * saltos / _CIEN
    return por_puntos * por_saltos


def bono_de_estrella(catalogo: Catalogo, etapa_estrella: int) -> int:
    parametros = catalogo.potencial
    etapas = catalogo.etapas_de_estrella
    if parametros is None or etapas is None or not parametros.cuenta_estrella:
        return 0
    return sum(e.bono_potencial for e in etapas.etapas if e.etapa <= etapa_estrella)


def bono_de_objeto(catalogo: Catalogo, objeto: ObjetoDelCatalogo, nivel: int, stat: Stat) -> int:
    parametros = catalogo.potencial
    bono = objeto.bono_potencial
    if parametros is None or not parametros.cuenta_objeto or bono is None:
        return 0
    return bono.stats.get(stat, 0) if nivel >= bono.desde_nivel else 0


def _sumar_estrellas_y_personalidad(
    acumulado: _Acumulado, catalogo: Catalogo, entrada: EntradaDeCalculo, stat: Stat
) -> None:
    for etapa in catalogo.estrellas or ():
        if etapa.etapa <= entrada.etapa_estrella:
            for modificador in etapa.modificadores.get(stat, ()):
                acumulado.sumar("estrella", f"etapa {etapa.etapa}", modificador)
    if catalogo.personalidad is not None and entrada.personalidad is not None:
        for letra in entrada.personalidad:
            datos = catalogo.personalidad.get(letra)
            for modificador in () if datos is None else datos.modificadores.get(stat, ()):
                acumulado.sumar("personalidad", letra, modificador)


def _intermedio_con_potencial(
    valor_base: Decimal,
    n: int,
    parametros: ParametrosDePotencial | None,
    acumulado: _Acumulado,
) -> Decimal:
    if parametros is None:
        return acumulado.aplicar_a(valor_base)
    saltos = n // parametros.salto_cada
    crecimiento = valor_base * (1 + parametros.por_punto * n / _CIEN)
    porcentaje = acumulado.porcentaje + parametros.salto_porcentaje * saltos
    return (crecimiento + acumulado.plano) * (1 + porcentaje / _CIEN)


def _terminos_de_potencial(parametros: ParametrosDePotencial, n: int) -> list[TerminoDeDesglose]:
    terminos: list[TerminoDeDesglose] = []
    if n > 0:
        terminos.append(
            TerminoDeDesglose(
                "potencial", f"N {n}", TipoDeTermino.PORCENTAJE, parametros.por_punto * n
            )
        )
    saltos = n // parametros.salto_cada
    if saltos > 0:
        terminos.append(
            TerminoDeDesglose(
                "salto",
                f"{saltos} saltos",
                TipoDeTermino.PORCENTAJE,
                parametros.salto_porcentaje * saltos,
            )
        )
    return terminos


@dataclass(frozen=True, slots=True)
class _ObjetoAplicado:
    objeto: ObjetoDelCatalogo
    nivel: NivelDeObjeto


def _resolver_objeto(
    catalogo: Catalogo, pedido: ObjetoDeLaEntrada
) -> tuple[ResultadoDeObjeto, _ObjetoAplicado | None]:
    if pedido.posicion is not PosicionObjeto.EQUIPADO:
        return ResultadoDeObjeto(pedido.posicion, False, NotaDeObjeto.ALTERNATIVO_NO_SUMA), None
    if pedido.objeto_id is None:
        return ResultadoDeObjeto(pedido.posicion, False, NotaDeObjeto.SIN_ELEGIR), None
    objeto = next((o for o in catalogo.objetos or () if o.id == pedido.objeto_id), None)
    if objeto is None:
        return ResultadoDeObjeto(pedido.posicion, False, NotaDeObjeto.OBJETO_DESCONOCIDO), None
    nivel = next((n for n in objeto.niveles if n.nivel == pedido.nivel), None)
    if nivel is None:
        return (
            ResultadoDeObjeto(pedido.posicion, False, NotaDeObjeto.NIVEL_DE_OBJETO_SIN_DATOS),
            None,
        )
    return ResultadoDeObjeto(pedido.posicion, True, None), _ObjetoAplicado(objeto, nivel)


def _resolver_objetos(
    catalogo: Catalogo, entrada: EntradaDeCalculo
) -> tuple[tuple[ResultadoDeObjeto, ...], _ObjetoAplicado | None]:
    resultados = [_resolver_objeto(catalogo, pedido) for pedido in entrada.objetos]
    aplicado = next((a for _, a in resultados if a is not None), None)
    return tuple(r for r, _ in resultados), aplicado


def _valor_no_negativo(valor: Decimal, redondeo: Redondeo) -> int | None:
    redondeado = _redondear(valor, redondeo)
    return redondeado if redondeado >= 0 else None


def _calcular_stat(
    catalogo: Catalogo,
    entrada: EntradaDeCalculo,
    especie: Especie,
    stat: Stat,
    objeto: _ObjetoAplicado | None,
) -> SugerenciaDeValor:
    base = _base_en_el_nivel(especie.base[stat], entrada.nivel, catalogo.interpolacion)
    if isinstance(base, MotivoDeValor):
        return SugerenciaDeValor(None, None, False, base, ())
    valor_base, aproximado = base
    desglose = [TerminoDeDesglose("base", f"nivel {entrada.nivel}", TipoDeTermino.BASE, valor_base)]
    parametros = catalogo.potencial
    n = entrada.potenciales[stat] + bono_de_estrella(catalogo, entrada.etapa_estrella)
    if parametros is not None:
        desglose += _terminos_de_potencial(parametros, n)
    acumulado = _Acumulado(Decimal(0), Decimal(0), desglose)
    _sumar_estrellas_y_personalidad(acumulado, catalogo, entrada, stat)
    intermedio = _intermedio_con_potencial(valor_base, n, parametros, acumulado)
    valor = _valor_no_negativo(intermedio, catalogo.redondeo)
    valor_con_objetos = valor
    if objeto is not None:
        valor_con_objetos = _valor_con_objeto(
            catalogo, objeto, stat, valor_base, n, acumulado, intermedio
        )
    motivo = (
        MotivoDeValor.RESULTADO_INVALIDO if valor is None or valor_con_objetos is None else None
    )
    return SugerenciaDeValor(valor, valor_con_objetos, aproximado, motivo, tuple(desglose))


def _valor_con_objeto(
    catalogo: Catalogo,
    objeto: _ObjetoAplicado,
    stat: Stat,
    valor_base: Decimal,
    n: int,
    acumulado: _Acumulado,
    intermedio: Decimal,
) -> int | None:
    detalle = f"{objeto.objeto.nombre} nivel {objeto.nivel.nivel}"
    bono = bono_de_objeto(catalogo, objeto.objeto, objeto.nivel.nivel, stat)
    modificadores = objeto.nivel.modificadores.get(stat, ())
    if bono == 0 and not modificadores:
        return _valor_no_negativo(intermedio, catalogo.redondeo)
    if bono > 0:
        acumulado.desglose.append(
            TerminoDeDesglose(
                "objeto", f"{detalle}: +{bono} potencial", TipoDeTermino.PUNTOS, Decimal(bono)
            )
        )
    del_objeto = _Acumulado(Decimal(0), Decimal(0), acumulado.desglose)
    for modificador in modificadores:
        del_objeto.sumar("objeto", detalle, modificador)
    con_el_objeto = _Acumulado(
        acumulado.porcentaje + del_objeto.porcentaje, acumulado.plano, acumulado.desglose
    )
    intermedio_con_objeto = _intermedio_con_potencial(
        valor_base, n + bono, catalogo.potencial, con_el_objeto
    )
    return _valor_no_negativo(intermedio_con_objeto + del_objeto.plano, catalogo.redondeo)


def _total_de_cp(
    formula: FormulaDeCp, valores: Mapping[Stat, int | None], potenciales: Mapping[Stat, int]
) -> Decimal | None:
    total = formula.constante
    for stat, peso in formula.pesos.items():
        valor = valores[stat]
        if valor is None:
            return None
        total += peso * valor
    if formula.por_punto_de_potencial is not None:
        total += formula.por_punto_de_potencial * sum(potenciales.values())
    return total


def _desglose_de_cp(
    formula: FormulaDeCp, valores: Mapping[Stat, int | None], potenciales: Mapping[Stat, int]
) -> tuple[TerminoDeDesglose, ...]:
    terminos: list[TerminoDeDesglose] = []
    if formula.constante != 0:
        terminos.append(
            TerminoDeDesglose("cp", "constante", TipoDeTermino.PLANO, formula.constante)
        )
    for stat in Stat:
        peso = formula.pesos.get(stat)
        valor = valores[stat]
        if peso is not None and valor is not None:
            terminos.append(
                TerminoDeDesglose("cp", f"{stat.value} x {peso}", TipoDeTermino.PESO, peso * valor)
            )
    if formula.por_punto_de_potencial is not None:
        puntos = formula.por_punto_de_potencial
        terminos.append(
            TerminoDeDesglose(
                "cp",
                f"potencial x {puntos}",
                TipoDeTermino.PESO,
                puntos * sum(potenciales.values()),
            )
        )
    return tuple(terminos)


def _calcular_cp(
    catalogo: Catalogo, entrada: EntradaDeCalculo, stats: Mapping[Stat, SugerenciaDeValor]
) -> SugerenciaDeValor:
    formula = catalogo.cp
    if formula is None:
        return SugerenciaDeValor(None, None, False, MotivoDeValor.SIN_DATOS, ())
    sin_objetos = {stat: sugerido.valor for stat, sugerido in stats.items()}
    con_objetos = {stat: sugerido.valor_con_objetos for stat, sugerido in stats.items()}
    total = _total_de_cp(formula, sin_objetos, entrada.potenciales)
    total_con_objetos = _total_de_cp(formula, con_objetos, entrada.potenciales)
    valor = None if total is None else _valor_no_negativo(total, catalogo.redondeo)
    valor_con_objetos = (
        None
        if total_con_objetos is None
        else _valor_no_negativo(total_con_objetos, catalogo.redondeo)
    )
    motivo = None
    if total is None or total_con_objetos is None:
        motivo = MotivoDeValor.STATS_INCOMPLETOS
    elif valor is None or valor_con_objetos is None:
        motivo = MotivoDeValor.RESULTADO_INVALIDO
    aproximado = any(stats[stat].aproximado for stat in formula.pesos)
    desglose = () if total is None else _desglose_de_cp(formula, sin_objetos, entrada.potenciales)
    return SugerenciaDeValor(valor, valor_con_objetos, aproximado, motivo, desglose)


def secciones_sin_datos(catalogo: Catalogo) -> tuple[str, ...]:
    presentes = {
        Seccion.POTENCIAL: catalogo.potencial,
        Seccion.ETAPAS_DE_ESTRELLA: catalogo.etapas_de_estrella,
        Seccion.DESPERTAR: catalogo.despertar,
        Seccion.ESTRELLAS: catalogo.estrellas,
        Seccion.PERSONALIDAD: catalogo.personalidad,
        Seccion.OBJETOS: catalogo.objetos,
        Seccion.CP: catalogo.cp,
    }
    return tuple(seccion.value for seccion, datos in presentes.items() if datos is None)


def calcular_sugerencia(catalogo: Catalogo, entrada: EntradaDeCalculo) -> Sugerencia:
    especie = next((e for e in catalogo.especies if e.id == entrada.especie_id), None)
    if especie is None:
        raise EspecieDesconocida
    objetos, aplicado = _resolver_objetos(catalogo, entrada)
    stats = {stat: _calcular_stat(catalogo, entrada, especie, stat, aplicado) for stat in Stat}
    return Sugerencia(
        stats=stats,
        cp=_calcular_cp(catalogo, entrada, stats),
        objetos=objetos,
        sin_datos=secciones_sin_datos(catalogo),
    )
