import type { CodigoDeError } from './auth'
import type { FichaDeAmigo, TeamDeAmigo } from './teams'

export const CANALES_AMIGOS = {
  buscar: 'amigos:buscar',
  listar: 'amigos:listar',
  enviarSolicitud: 'amigos:enviar-solicitud',
  aceptarSolicitud: 'amigos:aceptar-solicitud',
  eliminar: 'amigos:eliminar',
  listarTeams: 'amigos:listar-teams',
  obtenerFicha: 'amigos:obtener-ficha',
  obtenerImagen: 'amigos:obtener-imagen'
} as const

export const PATRON_DE_NOMBRE_DE_USUARIO = /^[A-Za-z0-9_]{3,32}$/

export type CodigoDeErrorDeAmigos = CodigoDeError | 'no-encontrado' | 'ya-existe'

export interface ErrorDeAmigos {
  readonly ok: false
  readonly error: CodigoDeErrorDeAmigos
}

export type Relacion = 'ninguna' | 'solicitud-enviada' | 'solicitud-recibida' | 'amigo'

export interface UsuarioEncontrado {
  readonly id: string
  readonly nombreUsuario: string
  readonly relacion: Relacion
}

export interface Amigo {
  readonly id: string
  readonly nombreUsuario: string
  readonly desde: string
}

export interface Solicitud {
  readonly id: string
  readonly nombreUsuario: string
  readonly creadaEn: string
}

export interface DuenioDeTeams {
  readonly id: string
  readonly nombreUsuario: string
}

export interface PedidoBuscar {
  readonly nombreUsuario: string
}

export interface PedidoDeUsuario {
  readonly usuarioId: string
}

export interface PedidoDeSlotDeAmigo {
  readonly usuarioId: string
  readonly teamId: string
  readonly slot: number
}

export type ResultadoBuscar =
  | { readonly ok: true; readonly usuario: UsuarioEncontrado | null }
  | ErrorDeAmigos

export type ResultadoListarAmigos =
  | {
      readonly ok: true
      readonly amigos: readonly Amigo[]
      readonly recibidas: readonly Solicitud[]
      readonly enviadas: readonly Solicitud[]
    }
  | ErrorDeAmigos

export type ResultadoUsuario =
  | { readonly ok: true; readonly usuario: UsuarioEncontrado }
  | ErrorDeAmigos

export type ResultadoVacioDeAmigos = { readonly ok: true } | ErrorDeAmigos

export type ResultadoTeamsDeAmigo =
  | {
      readonly ok: true
      readonly usuario: DuenioDeTeams
      readonly teams: readonly TeamDeAmigo[]
    }
  | ErrorDeAmigos

export type ResultadoFichaDeAmigo =
  | { readonly ok: true; readonly ficha: FichaDeAmigo | null }
  | ErrorDeAmigos

export type ResultadoImagenDeAmigo =
  | { readonly ok: true; readonly imagen: string | null }
  | ErrorDeAmigos
