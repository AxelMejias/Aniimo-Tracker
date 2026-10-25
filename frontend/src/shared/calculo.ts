import type { CodigoDeError } from './auth'
import type { CodigoDePosicionDeObjeto, CodigoDeStat } from './catalogos'

export const CANALES_CALCULO = {
  obtenerCatalogo: 'calculo:obtener-catalogo',
  calcular: 'calculo:calcular',
  potencial: 'calculo:potencial'
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

export const NOTAS_DE_OBJETO_DE_POTENCIAL = [
  'sin-elegir',
  'objeto-desconocido',
  'sin-bono-de-potencial'
] as const

export const CONFIANZAS = [
  'oficial',
  'medido',
  'fan',
  'inferido',
  'contradictorio',
  'ejemplo'
] as const

export const VIAS_DE_DESPERTAR = ['si', 'sin-cupo', 'tope'] as const

export type MotivoDeSugerencia = (typeof MOTIVOS_DE_SUGERENCIA)[number]
export type NotaDeObjeto = (typeof NOTAS_DE_OBJETO)[number]
export type NotaDeObjetoDePotencial = (typeof NOTAS_DE_OBJETO_DE_POTENCIAL)[number]
export type Confianza = (typeof CONFIANZAS)[number]
export type ViaDeDespertar = (typeof VIAS_DE_DESPERTAR)[number]

export type CodigoDeErrorDeCalculo = CodigoDeError | 'no-disponible' | 'especie-desconocida'

export interface ErrorDeCalculo {
  readonly ok: false
  readonly error: CodigoDeErrorDeCalculo
}

export interface ElementoDelCatalogo {
  readonly id: string
  readonly nombre: string
}

export interface CambioConocido {
  readonly fecha: string
  readonly descripcion: string
  readonly confianza: Confianza
}

export interface CatalogoResumen {
  readonly formato: number
  readonly version: string
  readonly esEjemplo: boolean
  readonly estimacionVerificada: boolean
  readonly fechaParche: string
  readonly cambiosConocidos: readonly CambioConocido[]
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
  readonly etapaEstrella: number
  readonly personalidad: string | null
  readonly objetos: readonly ObjetoDelPedido[]
}

export interface ObjetoEquipadoDelPedido {
  readonly objetoId: string | null
  readonly nivel: number
}

export interface PedidoPotencial {
  readonly nivel: number
  readonly etapaEstrella: number
  readonly potenciales: Readonly<Record<CodigoDeStat, number>>
  readonly personalidad: string | null
  readonly objetoEquipado: ObjetoEquipadoDelPedido | null
  readonly despertaresUsados: number
  readonly despertaresTotal: number
  readonly fechaParche: string | null
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
  readonly estimacionVerificada: boolean
  readonly fechaParche: string
  readonly stats: Readonly<Record<CodigoDeStat, SugerenciaDeValor>>
  readonly cp: SugerenciaDeValor
  readonly objetos: readonly ResultadoDeObjeto[]
  readonly sinDatos: readonly string[]
}

export interface PotencialDeStat {
  readonly potencial: number
  readonly bonoEstrella: number
  readonly bonoObjeto: number
  readonly n: number
  readonly saltos: number
  readonly proximoSalto: number
  readonly puntosAlProximo: number
  readonly porcentajePorPuntos: number
  readonly porcentajePorSaltos: number
  readonly viaDespertar: ViaDeDespertar
}

export interface PotencialEfectivo {
  readonly confianza: Confianza
  readonly porPunto: number
  readonly saltoCada: number
  readonly saltoPorcentaje: number
  readonly cuentaEstrella: boolean
  readonly cuentaObjeto: boolean
  readonly stats: Readonly<Record<CodigoDeStat, PotencialDeStat>>
}

export interface TramoDeCupo {
  readonly origen: string
  readonly detalle: string
  readonly suma: number
}

export interface CupoDeDespertar {
  readonly confianza: Confianza
  readonly cupoSugerido: number
  readonly desglose: readonly TramoDeCupo[]
  readonly totalCargado: number
  readonly diferencia: number
  readonly restantes: number
}

export interface BonoDeLetra {
  readonly stat: CodigoDeStat | null
  readonly descripcion: string
  readonly porcentaje: number
}

export interface SlotDePersonalidad {
  readonly letra: string
  readonly nombre: string | null
  readonly letraConfirmada: boolean
  readonly confianza: Confianza | null
  readonly bonos: readonly BonoDeLetra[]
}

export interface ObjetoDePotencial {
  readonly aplicado: boolean
  readonly nota: NotaDeObjetoDePotencial | null
}

export interface Potencial {
  readonly version: string
  readonly esEjemplo: boolean
  readonly fechaParche: string
  readonly potencial: PotencialEfectivo | null
  readonly despertar: CupoDeDespertar | null
  readonly personalidad: readonly SlotDePersonalidad[] | null
  readonly objeto: ObjetoDePotencial | null
  readonly versionDesconocida: boolean
  readonly avisos: readonly CambioConocido[]
  readonly sinDatos: readonly string[]
}

export type ResultadoCatalogo =
  | { readonly ok: true; readonly catalogo: CatalogoResumen }
  | ErrorDeCalculo

export type ResultadoCalcular =
  | { readonly ok: true; readonly sugerencia: Sugerencia }
  | ErrorDeCalculo

export type ResultadoPotencial = { readonly ok: true; readonly potencial: Potencial } | ErrorDeCalculo
