import { describe, expect, it, vi } from 'vitest'
import { guardarLimites, leerLimites } from './almacenDeLimites'

const RUTA = '/datos/overlay.json'
const VALIDO = { x: 50, y: 60, width: 400, height: 600 }

describe('leerLimites', () => {
  it('devuelve null si el archivo no existe', async () => {
    const leer = vi.fn(async () => {
      throw new Error('ENOENT')
    })
    expect(await leerLimites(RUTA, leer)).toBeNull()
    expect(leer).toHaveBeenCalledWith(RUTA)
  })

  it('devuelve null si no es JSON', async () => {
    expect(await leerLimites(RUTA, async () => 'no es json')).toBeNull()
  })

  it('devuelve null si el JSON es invalido', async () => {
    expect(await leerLimites(RUTA, async () => JSON.stringify({ ...VALIDO, extra: 1 }))).toBeNull()
    expect(await leerLimites(RUTA, async () => JSON.stringify({ ...VALIDO, width: 10 }))).toBeNull()
    expect(await leerLimites(RUTA, async () => 'null')).toBeNull()
  })

  it('devuelve los limites si son validos', async () => {
    expect(await leerLimites(RUTA, async () => JSON.stringify(VALIDO))).toEqual(VALIDO)
  })
})

describe('guardarLimites', () => {
  it('escribe exactamente x, y, width y height', async () => {
    const escribir = vi.fn(async () => undefined)
    await guardarLimites(RUTA, { ...VALIDO, extra: 'nada' } as typeof VALIDO, escribir)
    expect(escribir).toHaveBeenCalledTimes(1)
    const [ruta, contenido] = escribir.mock.calls[0] as unknown as [string, string]
    expect(ruta).toBe(RUTA)
    expect(JSON.parse(contenido)).toEqual(VALIDO)
    expect(Object.keys(JSON.parse(contenido) as object).sort()).toEqual([
      'height',
      'width',
      'x',
      'y'
    ])
  })

  it('un error de escritura no se propaga', async () => {
    const escribir = vi.fn(async () => {
      throw new Error('EACCES')
    })
    await expect(guardarLimites(RUTA, VALIDO, escribir)).resolves.toBeUndefined()
  })
})
