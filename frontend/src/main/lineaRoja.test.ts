import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PROHIBIDAS = [
  'desktopCapturer',
  'setDisplayMediaRequestHandler',
  'child_process',
  'globalShortcut',
  'sendInputEvent'
]
const RAIZ = resolve(__dirname, '..')
const ESTE_ARCHIVO = resolve(__filename)

function archivosTs(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name)
    if (entrada.isDirectory()) {
      return archivosTs(ruta)
    }
    return ruta.endsWith('.ts') && resolve(ruta) !== ESTE_ARCHIVO ? [ruta] : []
  })
}

describe('linea roja anti-cheat', () => {
  const archivos = [...archivosTs(join(RAIZ, 'main')), ...archivosTs(join(RAIZ, 'preload'))]

  it('recorre los archivos del main y del preload', () => {
    expect(archivos.length).toBeGreaterThan(20)
    expect(archivos.some((ruta) => ruta.endsWith('index.ts'))).toBe(true)
  })

  it.each(PROHIBIDAS)('ningun archivo contiene %s', (nombre) => {
    const infractores = archivos.filter((ruta) => readFileSync(ruta, 'utf8').includes(nombre))
    expect(infractores).toEqual([])
  })
})
