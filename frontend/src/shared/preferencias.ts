export const CANALES_PREFERENCIAS = {
  obtener: 'preferencias:obtener',
  cambiar: 'preferencias:cambiar'
} as const

export type ClaveDePreferencia = 'abrirAppConElJuego' | 'arrancarConWindows'

export interface PedidoCambiarPreferencia {
  readonly clave: ClaveDePreferencia
  readonly valor: boolean
}

export interface Preferencias {
  readonly abrirAppConElJuego: boolean
  readonly arrancarConWindows: boolean
  readonly segundoPlanoDisponible: boolean
}

export interface ErrorDePreferencias {
  readonly ok: false
  readonly error: 'datos-invalidos' | 'error-inesperado'
}

export type ResultadoPreferencias =
  | { readonly ok: true; readonly preferencias: Preferencias }
  | ErrorDePreferencias
