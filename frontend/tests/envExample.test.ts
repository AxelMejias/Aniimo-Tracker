import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ruta = resolve(__dirname, '../.env.example')

describe('frontend/.env.example', () => {
  it('lista las dos variables de la cuenta de test sin valores', () => {
    const lineas = readFileSync(ruta, 'utf-8')
      .split(/\r?\n/)
      .filter((linea) => linea.trim() !== '' && !linea.startsWith('#'))
    expect(lineas).toEqual(['VITE_CUENTA_TEST_USUARIO=', 'VITE_CUENTA_TEST_CONTRASENA='])
  })
})
