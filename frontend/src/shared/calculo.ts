import type { CodigoDeError } from './auth'
import type { CodigoDePosicionDeObjeto, CodigoDeStat } from './catalogos'

export const CANALES_CALCULO = {
  obtenerCatalogo: 'calculo:obtener-catalogo',
  calcular: 'calculo:calcular'
} as const

export const PATRON_DE_ID_DE_CATALOGO = /^[a-z0-9-]{1,50}$/

export const MOTIVOS_DE_SUGERENCIA = [
  'fuera-de-rango',
  'nivel-no-medido',
  'resultado-invalido',
  'sin-datos',
  'stats-incompletos'
] as const

export const NOTAS_DE_OBJETO = [
  'sin-elegir',
  'objeto-desconocido',
  'nivel-de-objeto-sin-datos',
  'alternativo-no-suma'
] as const

export type MotivoDeSugerencia = (typeof MOTIVOS_DE_SUGERENCIA)[number]
export type NotaDeObjeto = (typeof NOTAS_DE_OBJETO)[number]

export type CodigoDeErrorDeCalculo = CodigoDeError | 'no-disponible' | 'especie-desconocida'

export interface ErrorDeCalculo {
  readonly ok: false
  readonly error: CodigoDeErrorDeCalculo
}

export interface ElementoDelCatalogo {
  readonly id: string
  readonly nombre: string
}

export interface CatalogoResumen {
  readonly version: string
  readonly esEjemplo: boolean
  readonly especies: readonly ElementoDelCatalogo[]
  readonly objetos: readonly ElementoDelCatalogo[]
  readonly sinDatos: readonly string[]
}

export interface ObjetoDelPedido {
  readonly posicion: CodigoDePosicionDeObjeto
  readonly objetoId: string | null
  readonly nivel: number
}

export interface PedidoCalcular {
  readonly especieId: string
  readonly nivel: number
  readonly potenciales: Readonly<Record<CodigoDeStat, number>>
  readonly estrellaActual: number
  readonly personalidad: string | null
  readonly objetos: readonly ObjetoDelPedido[]
}

export interface TerminoDeDesglose {
  readonly origen: string
  readonly detalle: string
  readonly tipo: string
  readonly valor: number
}

export interface SugerenciaDeValor {
  readonly valor: number | null
  readonly valorConObjetos: number | null
  readonly aproximado: boolean
  readonly motivo: MotivoDeSugerencia | null
  readonly desglose: readonly TerminoDeDesglose[]
}

export interface ResultadoDeObjeto {
  readonly posicion: CodigoDePosicionDeObjeto
  readonly aplicado: boolean
  readonly nota: NotaDeObjeto | null
}

export interface Sugerencia {
  readonly version: string
  readonly esEjemplo: boolean
  readonly stats: Readonly<Record<CodigoDeStat, SugerenciaDeValor>>
  readonly cp: SugerenciaDeValor
  readonly objetos: readonly ResultadoDeObjeto[]
  readonly sinDatos: readonly string[]
}

export type ResultadoCatalogo =
  | { readonly ok: true; readonly catalogo: CatalogoResumen }
  | ErrorDeCalculo

export type ResultadoCalcular =
  | { readonly ok: true; readonly sugerencia: Sugerencia }
  | ErrorDeCalculo
