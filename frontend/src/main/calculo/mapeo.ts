import {
  CONFIANZAS,
  MOTIVOS_DE_SUGERENCIA,
  NOTAS_DE_OBJETO,
  NOTAS_DE_OBJETO_DE_POTENCIAL,
  VIAS_DE_DESPERTAR,
  type BonoDeLetra,
  type CambioConocido,
  type CatalogoResumen,
  type Confianza,
  type CupoDeDespertar,
  type ElementoDelCatalogo,
  type MotivoDeSugerencia,
  type NotaDeObjeto,
  type NotaDeObjetoDePotencial,
  type ObjetoDePotencial,
  type PedidoCalcular,
  type PedidoPotencial,
  type Potencial,
  type PotencialDeStat,
  type PotencialEfectivo,
  type ResultadoDeObjeto,
  type SlotDePersonalidad,
  type Sugerencia,
  type SugerenciaDeValor,
  type TerminoDeDesglose,
  type TramoDeCupo,
  type ViaDeDespertar
} from '../../shared/calculo'
import { POSICIONES_DE_OBJETO, STATS, type CodigoDeStat } from '../../shared/catalogos'
import { esFechaDeParche } from '../../shared/parche'
import {
  booleano,
  entero,
  enteroONulo,
  lista,
  registro,
  RespuestaInvalida,
  texto
} from '../teams/mapeo'

export function pedidoAApi(pedido: PedidoCalcular): Record<string, unknown> {
  return {
    especie_id: pedido.especieId,
    nivel: pedido.nivel,
    potenciales: { ...pedido.potenciales },
    etapa_estrella: pedido.etapaEstrella,
    personalidad: pedido.personalidad,
    objetos: pedido.objetos.map((objeto) => ({
      posicion: objeto.posicion,
      objeto_id: objeto.objetoId,
      nivel: objeto.nivel
    }))
  }
}

function elementoDeApi(valor: unknown): ElementoDelCatalogo {
  const elemento = registro(valor)
  return { id: texto(elemento.id), nombre: texto(elemento.nombre) }
}

function textos(valor: unknown): string[] {
  return lista(valor).map(texto)
}

function fecha(valor: unknown): string {
  if (!esFechaDeParche(valor)) {
    throw new RespuestaInvalida()
  }
  return valor
}

function confianza(valor: unknown): Confianza {
  const encontrada = CONFIANZAS.find((candidata) => candidata === valor)
  if (encontrada === undefined) {
    throw new RespuestaInvalida()
  }
  return encontrada
}

function cambioConocidoDeApi(valor: unknown): CambioConocido {
  const cambio = registro(valor)
  return {
    fecha: fecha(cambio.fecha),
    descripcion: texto(cambio.descripcion),
    confianza: confianza(cambio.confianza)
  }
}

export function catalogoDeApi(valor: unknown): CatalogoResumen {
  const catalogo = registro(valor)
  return {
    formato: entero(catalogo.formato),
    version: texto(catalogo.version),
    esEjemplo: booleano(catalogo.es_ejemplo),
    estimacionVerificada: booleano(catalogo.estimacion_verificada),
    fechaParche: fecha(catalogo.fecha_parche),
    cambiosConocidos: lista(catalogo.cambios_conocidos).map(cambioConocidoDeApi),
    especies: lista(catalogo.especies).map(elementoDeApi),
    objetos: lista(catalogo.objetos).map(elementoDeApi),
    sinDatos: textos(catalogo.sin_datos)
  }
}

function numero(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new RespuestaInvalida()
  }
  return valor
}

function motivoDeApi(valor: unknown): MotivoDeSugerencia | null {
  if (valor === null) {
    return null
  }
  const motivo = MOTIVOS_DE_SUGERENCIA.find((candidato) => candidato === valor)
  if (motivo === undefined) {
    throw new RespuestaInvalida()
  }
  return motivo
}

function notaDeApi(valor: unknown): NotaDeObjeto | null {
  if (valor === null) {
    return null
  }
  const nota = NOTAS_DE_OBJETO.find((candidata) => candidata === valor)
  if (nota === undefined) {
    throw new RespuestaInvalida()
  }
  return nota
}

function terminoDeApi(valor: unknown): TerminoDeDesglose {
  const termino = registro(valor)
  return {
    origen: texto(termino.origen),
    detalle: texto(termino.detalle),
    tipo: texto(termino.tipo),
    valor: numero(termino.valor)
  }
}

function valorSugeridoDeApi(valor: unknown): SugerenciaDeValor {
  const sugerido = registro(valor)
  return {
    valor: enteroONulo(sugerido.valor),
    valorConObjetos: enteroONulo(sugerido.valor_con_objetos),
    aproximado: booleano(sugerido.aproximado),
    motivo: motivoDeApi(sugerido.motivo),
    desglose: lista(sugerido.desglose).map(terminoDeApi)
  }
}

function objetoDeApi(valor: unknown): ResultadoDeObjeto {
  const objeto = registro(valor)
  const posicion = POSICIONES_DE_OBJETO.find((p) => p.codigo === objeto.posicion)
  if (posicion === undefined) {
    throw new RespuestaInvalida()
  }
  return {
    posicion: posicion.codigo,
    aplicado: booleano(objeto.aplicado),
    nota: notaDeApi(objeto.nota)
  }
}

export function sugerenciaDeApi(valor: unknown): Sugerencia {
  const sugerencia = registro(valor)
  const stats = registro(sugerencia.stats)
  const porStat = Object.fromEntries(
    STATS.map((stat) => [stat.codigo, valorSugeridoDeApi(stats[stat.codigo])])
  ) as Record<CodigoDeStat, SugerenciaDeValor>
  return {
    version: texto(sugerencia.version),
    esEjemplo: booleano(sugerencia.es_ejemplo),
    estimacionVerificada: booleano(sugerencia.estimacion_verificada),
    fechaParche: fecha(sugerencia.fecha_parche),
    stats: porStat,
    cp: valorSugeridoDeApi(sugerencia.cp),
    objetos: lista(sugerencia.objetos).map(objetoDeApi),
    sinDatos: textos(sugerencia.sin_datos)
  }
}

export function pedidoDePotencialAApi(pedido: PedidoPotencial): Record<string, unknown> {
  return {
    nivel: pedido.nivel,
    etapa_estrella: pedido.etapaEstrella,
    potenciales: { ...pedido.potenciales },
    personalidad: pedido.personalidad,
    objeto_equipado:
      pedido.objetoEquipado === null
        ? null
        : { objeto_id: pedido.objetoEquipado.objetoId, nivel: pedido.objetoEquipado.nivel },
    despertares_usados: pedido.despertaresUsados,
    despertares_total: pedido.despertaresTotal,
    fecha_parche: pedido.fechaParche
  }
}

function viaDeDespertar(valor: unknown): ViaDeDespertar {
  const via = VIAS_DE_DESPERTAR.find((candidata) => candidata === valor)
  if (via === undefined) {
    throw new RespuestaInvalida()
  }
  return via
}

function statDePotencialDeApi(valor: unknown): PotencialDeStat {
  const stat = registro(valor)
  return {
    potencial: entero(stat.potencial),
    bonoEstrella: entero(stat.bono_estrella),
    bonoObjeto: entero(stat.bono_objeto),
    n: entero(stat.n),
    saltos: entero(stat.saltos),
    proximoSalto: entero(stat.proximo_salto),
    puntosAlProximo: entero(stat.puntos_al_proximo),
    porcentajePorPuntos: numero(stat.porcentaje_por_puntos),
    porcentajePorSaltos: numero(stat.porcentaje_por_saltos),
    viaDespertar: viaDeDespertar(stat.via_despertar)
  }
}

function potencialEfectivoDeApi(valor: unknown): PotencialEfectivo {
  const potencial = registro(valor)
  const stats = registro(potencial.stats)
  return {
    confianza: confianza(potencial.confianza),
    porPunto: numero(potencial.por_punto),
    saltoCada: entero(potencial.salto_cada),
    saltoPorcentaje: numero(potencial.salto_porcentaje),
    cuentaEstrella: booleano(potencial.cuenta_estrella),
    cuentaObjeto: booleano(potencial.cuenta_objeto),
    stats: Object.fromEntries(
      STATS.map((stat) => [stat.codigo, statDePotencialDeApi(stats[stat.codigo])])
    ) as Record<CodigoDeStat, PotencialDeStat>
  }
}

function tramoDeCupoDeApi(valor: unknown): TramoDeCupo {
  const tramo = registro(valor)
  return { origen: texto(tramo.origen), detalle: texto(tramo.detalle), suma: entero(tramo.suma) }
}

function cupoDeApi(valor: unknown): CupoDeDespertar {
  const cupo = registro(valor)
  return {
    confianza: confianza(cupo.confianza),
    cupoSugerido: entero(cupo.cupo_sugerido),
    desglose: lista(cupo.desglose).map(tramoDeCupoDeApi),
    totalCargado: entero(cupo.total_cargado),
    diferencia: entero(cupo.diferencia),
    restantes: entero(cupo.restantes)
  }
}

function statONulo(valor: unknown): CodigoDeStat | null {
  if (valor === null) {
    return null
  }
  const stat = STATS.find((candidato) => candidato.codigo === valor)
  if (stat === undefined) {
    throw new RespuestaInvalida()
  }
  return stat.codigo
}

function bonoDeLetraDeApi(valor: unknown): BonoDeLetra {
  const bono = registro(valor)
  return {
    stat: statONulo(bono.stat),
    descripcion: texto(bono.descripcion),
    porcentaje: numero(bono.porcentaje)
  }
}

function slotDePersonalidadDeApi(valor: unknown): SlotDePersonalidad {
  const slot = registro(valor)
  return {
    letra: texto(slot.letra),
    nombre: slot.nombre === null ? null : texto(slot.nombre),
    letraConfirmada: booleano(slot.letra_confirmada),
    confianza: slot.confianza === null ? null : confianza(slot.confianza),
    bonos: lista(slot.bonos).map(bonoDeLetraDeApi)
  }
}

function notaDeObjetoDePotencial(valor: unknown): NotaDeObjetoDePotencial | null {
  if (valor === null) {
    return null
  }
  const nota = NOTAS_DE_OBJETO_DE_POTENCIAL.find((candidata) => candidata === valor)
  if (nota === undefined) {
    throw new RespuestaInvalida()
  }
  return nota
}

function objetoDePotencialDeApi(valor: unknown): ObjetoDePotencial {
  const objeto = registro(valor)
  return { aplicado: booleano(objeto.aplicado), nota: notaDeObjetoDePotencial(objeto.nota) }
}

export function potencialDeApi(valor: unknown): Potencial {
  const r = registro(valor)
  return {
    version: texto(r.version),
    esEjemplo: booleano(r.es_ejemplo),
    fechaParche: fecha(r.fecha_parche),
    potencial: r.potencial === null ? null : potencialEfectivoDeApi(r.potencial),
    despertar: r.despertar === null ? null : cupoDeApi(r.despertar),
    personalidad:
      r.personalidad === null ? null : lista(r.personalidad).map(slotDePersonalidadDeApi),
    objeto: r.objeto === null ? null : objetoDePotencialDeApi(r.objeto),
    versionDesconocida: booleano(r.version_desconocida),
    avisos: lista(r.avisos).map(cambioConocidoDeApi),
    sinDatos: textos(r.sin_datos)
  }
}
