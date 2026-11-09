import type { RutasDeArranque } from './rutas'

export type ResultadoDeConfiguracion = 'creada' | 'existente' | 'incompleta'

export type SistemaDeArchivos = {
  readonly existe: (ruta: string) => boolean
  readonly crearCarpeta: (ruta: string) => void
  // Falla si el archivo ya existe: nunca se pisa una configuracion previa.
  readonly escribirNuevo: (ruta: string, contenido: string) => void
}

export type Aleatorio = (bytes: number) => Buffer

const BYTES_DE_CONTRASENA = 32
const USUARIO = 'aniimo'
const BASE = 'aniimo'
export const PUERTO_DE_LA_BASE = 5436
export const PUERTO_DEL_BACKEND = 8001

export function prepararConfiguracion(
  rutas: RutasDeArranque,
  sistema: SistemaDeArchivos,
  aleatorio: Aleatorio
): ResultadoDeConfiguracion {
  const hayCompose = sistema.existe(rutas.composeEnv)
  const hayBackend = sistema.existe(rutas.backendEnv)
  if (hayCompose && hayBackend) {
    return 'existente'
  }
  if (hayCompose || hayBackend) {
    return 'incompleta'
  }

  const contrasena = aleatorio(BYTES_DE_CONTRASENA).toString('base64url')
  sistema.crearCarpeta(rutas.carpetaDelBackend)
  sistema.escribirNuevo(
    rutas.composeEnv,
    `POSTGRES_USER=${USUARIO}\nPOSTGRES_DB=${BASE}\nPOSTGRES_PASSWORD=${contrasena}\n`
  )
  sistema.escribirNuevo(
    rutas.backendEnv,
    `DATABASE_URL=postgresql+psycopg://${USUARIO}:${contrasena}@127.0.0.1:${PUERTO_DE_LA_BASE}/${BASE}\n` +
      `BACKEND_PORT=${PUERTO_DEL_BACKEND}\nLOG_LEVEL=INFO\n`
  )
  return 'creada'
}
