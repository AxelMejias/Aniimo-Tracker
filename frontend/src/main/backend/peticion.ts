import type { SesionEnMemoria } from '../auth/sesionEnMemoria'

export const URL_BASE_BACKEND = 'http://127.0.0.1:8000/api'
const TIEMPO_MAXIMO_MS = 10_000

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type Cuerpo =
  | { readonly json: unknown }
  | { readonly binario: Uint8Array; readonly tipo: string }

// Devuelve null cuando no hubo respuesta (red caida, tiempo agotado).
export type Peticion = (metodo: Metodo, ruta: string, cuerpo?: Cuerpo) => Promise<Response | null>

export function crearPeticion(fetchFn: FetchFn, sesion: SesionEnMemoria): Peticion {
  return async (metodo, ruta, cuerpo) => {
    const cabeceras: Record<string, string> = {}
    let contenido: BodyInit | undefined
    if (cuerpo !== undefined) {
      if ('json' in cuerpo) {
        cabeceras['Content-Type'] = 'application/json'
        contenido = JSON.stringify(cuerpo.json)
      } else {
        cabeceras['Content-Type'] = cuerpo.tipo
        contenido = new Uint8Array(cuerpo.binario)
      }
    }
    const actual = sesion.obtener()
    if (actual !== null) {
      cabeceras.Authorization = `Bearer ${actual.token}`
    }
    try {
      return await fetchFn(`${URL_BASE_BACKEND}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: contenido,
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
      })
    } catch {
      return null
    }
  }
}
