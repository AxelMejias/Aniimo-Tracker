import { describe, expect, it } from 'vitest'
import { esNombreDeProcesoValido, NOMBRES_DEL_JUEGO } from './nombresDelJuego'

describe('NOMBRES_DEL_JUEGO', () => {
  it('es solo Aniimo.exe', () => {
    expect(NOMBRES_DEL_JUEGO).toEqual(['Aniimo.exe'])
  })

  it('cada nombre es valido', () => {
    expect(NOMBRES_DEL_JUEGO.every(esNombreDeProcesoValido)).toBe(true)
  })
})

describe('esNombreDeProcesoValido', () => {
  it.each(['Aniimo.exe', 'mi juego_2-b.exe', 'a.exe'])('acepta %s', (nombre) => {
    expect(esNombreDeProcesoValido(nombre)).toBe(true)
  })

  it.each([
    ['con argumento inyectado', 'Aniimo.exe" /M'],
    ['con ruta relativa', '..\\x.exe'],
    ['con barra', 'a/b.exe'],
    ['vacio', ''],
    ['sin .exe', 'Aniimo'],
    ['solo la extension', '.exe'],
    ['con comillas', '"Aniimo.exe"'],
    ['demasiado largo', `${'a'.repeat(65)}.exe`]
  ])('rechaza el nombre %s', (_motivo, nombre) => {
    expect(esNombreDeProcesoValido(nombre)).toBe(false)
  })
})
