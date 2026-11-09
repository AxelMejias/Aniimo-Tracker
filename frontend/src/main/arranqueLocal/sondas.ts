import { createConnection } from 'node:net'
import type { FetchFn } from '../backend/peticion'

const TIEMPO_DE_SONDA_MS = 1_000

export function puertoRespondiendo(puerto: number): Promise<boolean> {
  return new Promise((resolver) => {
    const conexion = createConnection({ host: '127.0.0.1', port: puerto })
    const terminar = (respondio: boolean): void => {
      conexion.destroy()
      resolver(respondio)
    }
    conexion.setTimeout(TIEMPO_DE_SONDA_MS)
    conexion.once('connect', () => terminar(true))
    conexion.once('timeout', () => terminar(false))
    conexion.once('error', () => terminar(false))
  })
}

export async function backendSaludable(fetchFn: FetchFn, urlBase: string): Promise<boolean> {
  try {
    const respuesta = await fetchFn(`${urlBase}/health`, {
      signal: AbortSignal.timeout(TIEMPO_DE_SONDA_MS)
    })
    return respuesta.status === 200
  } catch {
    return false
  }
}
