import { describe, expect, it, vi } from 'vitest'
import { guardarPreferencias, leerPreferencias } from './preferencias'

const APAGADO = { abrirAppConElJuego: false }

describe('leerPreferencias', () => {
  it('lee la opcion encendida', async () => {
    const leer = vi.fn(async () => '{"abrirAppConElJuego":true}')
    expect(await leerPreferencias('p.json', leer)).toEqual({ abrirAppConElJuego: true })
    expect(leer).toHaveBeenCalledWith('p.json')
  })

  it('lee la opcion apagada', async () => {
    expect(await leerPreferencias('p.json', async () => '{"abrirAppConElJuego":false}')).toEqual(
      APAGADO
    )
  })

  it.each([
    ['archivo ausente', async () => Promise.reject(new Error('ENOENT'))],
    ['no es JSON', async () => 'esto no es json'],
    ['es null', async () => 'null'],
    ['es un arreglo', async () => '[true]'],
    ['clave extra', async () => '{"abrirAppConElJuego":true,"token":"x"}'],
    ['tipo incorrecto', async () => '{"abrirAppConElJuego":"si"}'],
    ['clave faltante', async () => '{}'],
    ['clave distinta', async () => '{"otra":true}']
  ])('todo apagado con %s', async (_motivo, leer) => {
    expect(await leerPreferencias('p.json', leer)).toEqual(APAGADO)
  })
})

describe('guardarPreferencias', () => {
  it('escribe solo la clave abrirAppConElJuego', async () => {
    const escribir = vi.fn(async () => undefined)
    const completas = { abrirAppConElJuego: true, arrancarConWindows: true, segundoPlanoDisponible: true }

    await guardarPreferencias('p.json', completas, escribir)

    expect(escribir).toHaveBeenCalledTimes(1)
    const [ruta, contenido] = escribir.mock.calls[0] as unknown as [string, string]
    expect(ruta).toBe('p.json')
    expect(JSON.parse(contenido)).toEqual({ abrirAppConElJuego: true })
  })

  it('escribe false cuando esta apagada', async () => {
    const escribir = vi.fn(async () => undefined)
    await guardarPreferencias('p.json', { abrirAppConElJuego: false }, escribir)
    const [, contenido] = escribir.mock.calls[0] as unknown as [string, string]
    expect(JSON.parse(contenido)).toEqual({ abrirAppConElJuego: false })
  })

  it('no lanza si no puede escribir', async () => {
    await expect(
      guardarPreferencias('p.json', APAGADO, async () => Promise.reject(new Error('EACCES')))
    ).resolves.toBeUndefined()
  })
})
