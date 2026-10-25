export const CANALES_OVERLAY = {
  abrir: 'overlay:abrir',
  cerrar: 'overlay:cerrar',
  obtenerSeleccion: 'overlay:obtener-seleccion'
} as const

export type CodigoDeErrorDeOverlay = 'datos-invalidos' | 'sesion-vencida' | 'error-inesperado'

export interface ErrorDeOverlay {
  readonly ok: false
  readonly error: CodigoDeErrorDeOverlay
}

export interface PedidoAbrirOverlay {
  readonly teamId: string
}

export interface SeleccionDeOverlay {
  readonly teamId: string
}

export type ResultadoOverlay = { readonly ok: true } | ErrorDeOverlay

export type ResultadoSeleccion =
  | { readonly ok: true; readonly seleccion: SeleccionDeOverlay | null }
  | ErrorDeOverlay
