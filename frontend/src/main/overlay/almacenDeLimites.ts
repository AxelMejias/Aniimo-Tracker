import { esLimitesValidos, type Rect } from './limites'

export type LeerArchivo = (ruta: string) => Promise<string>
export type EscribirArchivo = (ruta: string, contenido: string) => Promise<void>

export async function leerLimites(ruta: string, leer: LeerArchivo): Promise<Rect | null> {
  try {
    const valor: unknown = JSON.parse(await leer(ruta))
    return esLimitesValidos(valor) ? valor : null
  } catch {
    return null
  }
}

export async function guardarLimites(
  ruta: string,
  limites: Rect,
  escribir: EscribirArchivo
): Promise<void> {
  const { x, y, width, height } = limites
  try {
    await escribir(ruta, JSON.stringify({ x, y, width, height }))
  } catch {
    // El overlay se cierra igual; perder la posicion no afecta datos.
  }
}
