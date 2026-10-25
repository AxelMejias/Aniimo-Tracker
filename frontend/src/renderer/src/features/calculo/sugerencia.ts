import type {
  ElementoDelCatalogo,
  ObjetoDelPedido,
  PedidoCalcular,
  Sugerencia,
  SugerenciaDeValor
} from '../../../../shared/calculo'
import {
  STATS,
  type CodigoDePosicionDeObjeto,
  type CodigoDeStat
} from '../../../../shared/catalogos'
import {
  enteroDeTexto,
  POSICIONES_DE_OBJETO_EN_ORDEN,
  type FormularioDeFicha
} from '../aniimo/formulario'
import { MENSAJE_DE_PERSONALIDAD } from '../aniimo/validacionFicha'

export type CampoSugerible = CodigoDeStat | 'cp'

export type ObjetosElegidos = Readonly<Record<CodigoDePosicionDeObjeto, string | null>>

export type ResultadoDeEntrada =
  | { readonly ok: true; readonly pedido: PedidoCalcular }
  | { readonly ok: false; readonly motivo: string }

function sinTildesNiMayusculas(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function porNombre(
  nombre: string,
  candidatos: readonly ElementoDelCatalogo[]
): string | null {
  const buscado = sinTildesNiMayusculas(nombre)
  if (buscado === '') {
    return null
  }
  return candidatos.find((c) => sinTildesNiMayusculas(c.nombre) === buscado)?.id ?? null
}

function enteroEntre(texto: string, minimo: number, maximo: number): number | null {
  const valor = enteroDeTexto(texto)
  return valor !== null && valor >= minimo && valor <= maximo ? valor : null
}

function personalidadDe(letras: FormularioDeFicha['personalidad']): string | null | undefined {
  const completas = letras.filter((letra) => letra !== '').length
  if (completas === 0) {
    return null
  }
  return completas === letras.length ? letras.join('') : undefined
}

function objetosDelPedido(
  formulario: FormularioDeFicha,
  elegidos: ObjetosElegidos
): readonly ObjetoDelPedido[] | string {
  const objetos: ObjetoDelPedido[] = []
  for (const [indice, posicion] of POSICIONES_DE_OBJETO_EN_ORDEN.entries()) {
    const objeto = formulario.objetos[indice]
    if (objeto === undefined || objeto.nombre.trim() === '') {
      continue
    }
    const nivel = enteroEntre(objeto.nivel, 1, 99)
    if (nivel === null) {
      return `Revisá el nivel del objeto ${posicion}: debe ser un número entre 1 y 99`
    }
    objetos.push({ posicion, objetoId: elegidos[posicion], nivel })
  }
  return objetos
}

export function entradaDesdeFormulario(
  formulario: FormularioDeFicha,
  especieId: string,
  objetosElegidos: ObjetosElegidos
): ResultadoDeEntrada {
  const nivel = enteroEntre(formulario.nivel, 1, 999)
  if (nivel === null) {
    return { ok: false, motivo: 'Revisá el nivel: debe ser un número entre 1 y 999' }
  }
  const estrellaActual = enteroEntre(formulario.estrellaActual, 0, 99)
  if (estrellaActual === null) {
    return { ok: false, motivo: 'Revisá la estrella actual: debe ser un número entre 0 y 99' }
  }
  const personalidad = personalidadDe(formulario.personalidad)
  if (personalidad === undefined) {
    return { ok: false, motivo: MENSAJE_DE_PERSONALIDAD }
  }
  const potenciales = {} as Record<CodigoDeStat, number>
  for (const { codigo, etiqueta } of STATS) {
    const potencial = enteroEntre(formulario.stats[codigo].potencial, 0, 20)
    if (potencial === null) {
      return {
        ok: false,
        motivo: `Revisá el potencial de ${etiqueta}: debe ser un número entre 0 y 20`
      }
    }
    potenciales[codigo] = potencial
  }
  const objetos = objetosDelPedido(formulario, objetosElegidos)
  if (typeof objetos === 'string') {
    return { ok: false, motivo: objetos }
  }
  return {
    ok: true,
    pedido: { especieId, nivel, potenciales, estrellaActual, personalidad, objetos }
  }
}

export function valorMostrado(sugerido: SugerenciaDeValor, incluirObjetos: boolean): number | null {
  return incluirObjetos ? sugerido.valorConObjetos : sugerido.valor
}

export function aplicarSugerencia(
  formulario: FormularioDeFicha,
  campo: CampoSugerible,
  valor: number
): FormularioDeFicha {
  if (campo === 'cp') {
    return { ...formulario, cp: String(valor) }
  }
  return {
    ...formulario,
    stats: {
      ...formulario.stats,
      [campo]: { ...formulario.stats[campo], valorActual: String(valor) }
    }
  }
}

export function aplicarTodas(
  formulario: FormularioDeFicha,
  sugerencia: Sugerencia,
  incluirObjetos: boolean
): FormularioDeFicha {
  const campos: [CampoSugerible, SugerenciaDeValor][] = [
    ...STATS.map(({ codigo }): [CampoSugerible, SugerenciaDeValor] => [
      codigo,
      sugerencia.stats[codigo]
    ]),
    ['cp', sugerencia.cp]
  ]
  return campos.reduce((actual, [campo, sugerido]) => {
    const valor = valorMostrado(sugerido, incluirObjetos)
    return valor === null ? actual : aplicarSugerencia(actual, campo, valor)
  }, formulario)
}

export function diferencia(valorActual: string, sugerido: number | null): number | null {
  const actual = enteroDeTexto(valorActual)
  return actual === null || sugerido === null ? null : sugerido - actual
}

export function estaDesactualizada(
  pedidoActual: PedidoCalcular | null,
  pedidoCalculado: PedidoCalcular
): boolean {
  return pedidoActual === null || JSON.stringify(pedidoActual) !== JSON.stringify(pedidoCalculado)
}
