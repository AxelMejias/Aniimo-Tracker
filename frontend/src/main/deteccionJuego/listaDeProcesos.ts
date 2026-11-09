import * as procesosDelSistema from 'node:child_process'
import { win32 } from 'node:path'
import { esNombreDeProcesoValido } from './nombresDelJuego'

export type ModuloDeLista = {
  readonly execFile: (
    archivo: string,
    argumentos: readonly string[],
    opciones: {
      readonly shell: false
      readonly windowsHide: true
      readonly timeout: number
      readonly maxBuffer: number
      readonly encoding: 'utf8'
    },
    alTerminar: (error: Error | null, salida: string) => void
  ) => unknown
}

const TOPE_DE_TIEMPO_MS = 4000
const TOPE_DE_SALIDA = 64 * 1024

const moduloReal = procesosDelSistema as unknown as ModuloDeLista

export function estaCorriendo(
  nombre: string,
  modulo: ModuloDeLista = moduloReal,
  raizDelSistema: string = process.env['SystemRoot'] ?? 'C:\\Windows'
): Promise<boolean> {
  if (!esNombreDeProcesoValido(nombre)) {
    return Promise.resolve(false)
  }
  const tasklist = win32.join(raizDelSistema, 'System32', 'tasklist.exe')
  const argumentos = ['/FI', `IMAGENAME eq ${nombre}`, '/FO', 'CSV', '/NH']
  const buscado = `"${nombre.toLowerCase()}",`

  return new Promise((resolver) => {
    modulo.execFile(
      tasklist,
      argumentos,
      {
        shell: false,
        windowsHide: true,
        timeout: TOPE_DE_TIEMPO_MS,
        maxBuffer: TOPE_DE_SALIDA,
        encoding: 'utf8'
      },
      (error, salida) => {
        if (error !== null) {
          resolver(false)
          return
        }
        const filas = salida.split(/\r?\n/).map((fila) => fila.trim().toLowerCase())
        resolver(filas.some((fila) => fila.startsWith(buscado)))
      }
    )
  })
}
