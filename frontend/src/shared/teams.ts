import type { CodigoDeError } from './auth'
import type {
  CodigoDeElemento,
  CodigoDePosicionDeObjeto,
  CodigoDePotencialInnato,
  CodigoDeRareza,
  CodigoDeRol,
  CodigoDeStat
} from './catalogos'

export const CANALES_TEAMS = {
  listar: 'teams:listar',
  crear: 'teams:crear',
  renombrar: 'teams:renombrar',
  borrar: 'teams:borrar',
  obtenerFicha: 'teams:obtener-ficha',
  guardarFicha: 'teams:guardar-ficha',
  vaciarSlot: 'teams:vaciar-slot',
  obtenerImagen: 'teams:obtener-imagen',
  guardarImagen: 'teams:guardar-imagen',
  borrarImagen: 'teams:borrar-imagen'
} as const

export const LARGO_MAXIMO_NOMBRE_CORTO = 50
export const LARGO_MAXIMO_NOTAS_DE_STAT = 500
export const LARGO_MAXIMO_EFECTO_NUCLEO = 1000
export const LARGO_MAXIMO_NOTAS = 4000
export const TAMANO_MAXIMO_DE_IMAGEN = 1_048_576
export const LADO_MAXIMO_DE_IMAGEN = 512

export const TIPOS_DE_IMAGEN = ['image/png', 'image/jpeg', 'image/webp'] as const
export type TipoDeImagen = (typeof TIPOS_DE_IMAGEN)[number]

export type CodigoDeErrorDeTeams =
  | CodigoDeError
  | 'no-encontrado'
  | 'limite-de-teams'
  | 'conflicto'
  | 'imagen-invalida'

export interface ErrorDeTeams {
  readonly ok: false
  readonly error: CodigoDeErrorDeTeams
  readonly campos?: readonly string[]
}

export interface ValoresDeStat {
  readonly valorActual: number
  readonly potencial: number
  readonly bonoEstrellasIncluido: number
  readonly notas: string | null
}

export interface Material {
  readonly posicion: number
  readonly nombre: string
  readonly tengo: number
  readonly necesito: number
}

export interface Entrenamiento {
  readonly estrellaActual: number
  readonly nivelRequeridoSiguienteEtapa: number | null
  readonly gananciaDespertar: number
  readonly gananciaSeisPotenciales: number
  readonly despertaresUsados: number
  readonly despertaresTotal: number
  readonly materiales: readonly Material[]
}

export interface Objeto {
  readonly posicion: CodigoDePosicionDeObjeto
  readonly nombre: string
  readonly rareza: CodigoDeRareza
  readonly nivel: number
  readonly contrato: boolean
  readonly efectoNucleoNotas: string | null
}

export interface FichaEntrada {
  readonly nombre: string
  readonly elemento: CodigoDeElemento | null
  readonly rol: CodigoDeRol | null
  readonly potencialInnato: CodigoDePotencialInnato | null
  readonly personalidad: string | null
  readonly nivel: number
  readonly cp: number
  readonly stats: Readonly<Record<CodigoDeStat, ValoresDeStat>>
  readonly entrenamiento: Entrenamiento
  readonly objetos: readonly Objeto[]
  readonly notasHabilidades: string | null
  readonly notas: string | null
}

export interface Ficha extends FichaEntrada {
  readonly slot: number
  readonly tieneImagen: boolean
}

export interface ResumenDeAniimo {
  readonly nombre: string
  readonly nivel: number
  readonly cp: number
  readonly personalidad: string | null
  readonly estrellaActual: number
  readonly despertaresUsados: number
  readonly despertaresTotal: number
  readonly tieneImagen: boolean
}

export interface SlotDeTeam {
  readonly slot: number
  readonly aniimo: ResumenDeAniimo | null
}

export interface TeamResumen {
  readonly id: string
  readonly nombre: string
  readonly orden: number
  readonly slots: readonly SlotDeTeam[]
}

export interface PedidoCrear {
  readonly nombre: string
}

export interface PedidoRenombrar {
  readonly teamId: string
  readonly nombre: string
}

export interface PedidoDeTeam {
  readonly teamId: string
}

export interface PedidoDeSlot {
  readonly teamId: string
  readonly slot: number
}

export interface PedidoGuardarFicha extends PedidoDeSlot {
  readonly ficha: FichaEntrada
}

export interface PedidoGuardarImagen extends PedidoDeSlot {
  readonly tipo: TipoDeImagen
  readonly datos: Uint8Array
}

export type ResultadoListar =
  | { readonly ok: true; readonly teams: readonly TeamResumen[] }
  | ErrorDeTeams

export type ResultadoTeam = { readonly ok: true; readonly team: TeamResumen } | ErrorDeTeams

export type ResultadoVacio = { readonly ok: true } | ErrorDeTeams

export type ResultadoFicha = { readonly ok: true; readonly ficha: Ficha | null } | ErrorDeTeams

export type ResultadoImagen = { readonly ok: true; readonly imagen: string | null } | ErrorDeTeams
