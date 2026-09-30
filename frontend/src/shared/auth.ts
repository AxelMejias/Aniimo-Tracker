export const CANALES_AUTH = {
  registrarse: 'auth:registrarse',
  iniciarSesion: 'auth:iniciar-sesion',
  cerrarSesion: 'auth:cerrar-sesion',
  obtenerSesion: 'auth:obtener-sesion'
} as const

export const LARGO_MAXIMO_NOMBRE = 64
export const LARGO_MAXIMO_CONTRASENA = 128

export type CodigoDeError =
  | 'credenciales-invalidas'
  | 'nombre-no-disponible'
  | 'datos-invalidos'
  | 'demasiados-intentos'
  | 'sesion-vencida'
  | 'sin-conexion'
  | 'error-inesperado'

export interface Credenciales {
  readonly nombreUsuario: string
  readonly contrasena: string
}

export interface ErrorDeAuth {
  readonly ok: false
  readonly error: CodigoDeError
  readonly campos?: readonly string[]
  readonly reintentarEnSegundos?: number
}

export type ResultadoAuth = { readonly ok: true; readonly nombreUsuario: string } | ErrorDeAuth

export type ResultadoSesion =
  | { readonly ok: true; readonly nombreUsuario: string | null }
  | ErrorDeAuth
