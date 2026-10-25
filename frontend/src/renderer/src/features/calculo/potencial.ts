import type {
  Confianza,
  PedidoPotencial,
  ViaDeDespertar
} from '../../../../shared/calculo'
import { STATS, type CodigoDeStat } from '../../../../shared/catalogos'
import { esFechaDeParche } from '../../../../shared/parche'
import type { FormularioDeFicha } from '../aniimo/formulario'
import { MENSAJE_DE_FECHA_DE_PARCHE, MENSAJE_DE_PERSONALIDAD } from '../aniimo/validacionFicha'
import { enteroEntre, etapaDeEstrella, MENSAJE_SIN_ETAPA, personalidadDe } from './sugerencia'

export type ResultadoDeEntradaDePotencial =
  | { readonly ok: true; readonly pedido: PedidoPotencial }
  | { readonly ok: false; readonly motivo: string }

export const MENSAJE_DE_DESPERTARES_INVALIDOS =
  'Revisá los despertares: deben ser números enteros válidos'
export const MENSAJE_DE_USADOS_SOBRE_EL_TOTAL =
  'Los despertares usados no pueden superar los totales'

function motivo(texto: string): ResultadoDeEntradaDePotencial {
  return { ok: false, motivo: texto }
}

function potenciales(
  formulario: FormularioDeFicha
): Record<CodigoDeStat, number> | string {
  const resultado = {} as Record<CodigoDeStat, number>
  for (const { codigo, etiqueta } of STATS) {
    const potencial = enteroEntre(formulario.stats[codigo].potencial, 0, 20)
    if (potencial === null) {
      return `Revisá el potencial de ${etiqueta}: debe ser un número entre 0 y 20`
    }
    resultado[codigo] = potencial
  }
  return resultado
}

export function entradaDePotencial(
  formulario: FormularioDeFicha,
  objetoElegido: string | null
): ResultadoDeEntradaDePotencial {
  const nivel = enteroEntre(formulario.nivel, 1, 999)
  if (nivel === null) {
    return motivo('Revisá el nivel: debe ser un número entre 1 y 999')
  }
  const etapaEstrella = etapaDeEstrella(formulario.etapaEstrella)
  if (etapaEstrella === null) {
    return motivo(MENSAJE_SIN_ETAPA)
  }
  const personalidad = personalidadDe(formulario.personalidad)
  if (personalidad === undefined) {
    return motivo(MENSAJE_DE_PERSONALIDAD)
  }
  const porStat = potenciales(formulario)
  if (typeof porStat === 'string') {
    return motivo(porStat)
  }
  const usados = enteroEntre(formulario.despertaresUsados, 0, 9999)
  const total = enteroEntre(formulario.despertaresTotal, 0, 9999)
  if (usados === null || total === null) {
    return motivo(MENSAJE_DE_DESPERTARES_INVALIDOS)
  }
  if (usados > total) {
    return motivo(MENSAJE_DE_USADOS_SOBRE_EL_TOTAL)
  }
  const equipado = formulario.objetos[0]
  let objetoEquipado: PedidoPotencial['objetoEquipado'] = null
  if (equipado !== undefined && equipado.nombre.trim() !== '') {
    const nivelDelObjeto = enteroEntre(equipado.nivel, 1, 99)
    if (nivelDelObjeto === null) {
      return motivo('Revisá el nivel del objeto equipado: debe ser un número entre 1 y 99')
    }
    objetoEquipado = { objetoId: objetoElegido, nivel: nivelDelObjeto }
  }
  const fecha = formulario.fechaParche.trim()
  if (fecha !== '' && !esFechaDeParche(fecha)) {
    return motivo(MENSAJE_DE_FECHA_DE_PARCHE)
  }
  return {
    ok: true,
    pedido: {
      nivel,
      etapaEstrella,
      potenciales: porStat,
      personalidad,
      objetoEquipado,
      despertaresUsados: usados,
      despertaresTotal: total,
      fechaParche: fecha === '' ? null : fecha
    }
  }
}

export function aplicarCupo(formulario: FormularioDeFicha, cupo: number): FormularioDeFicha {
  return { ...formulario, despertaresTotal: String(cupo) }
}

export function etiquetaDeViaDespertar(via: ViaDeDespertar): string {
  switch (via) {
    case 'si':
      return 'sí'
    case 'sin-cupo':
      return 'sin cupo'
    case 'tope':
      return 'no: solo estrellas u objetos'
  }
}

export function textoDeConfianza(confianza: Confianza): string {
  switch (confianza) {
    case 'fan':
      return 'dato de fans'
    case 'ejemplo':
      return 'de ejemplo'
    case 'oficial':
    case 'medido':
    case 'inferido':
    case 'contradictorio':
      return confianza
  }
}

export function estaDesactualizado(
  pedidoActual: PedidoPotencial | null,
  pedidoCalculado: PedidoPotencial
): boolean {
  return pedidoActual === null || JSON.stringify(pedidoActual) !== JSON.stringify(pedidoCalculado)
}
