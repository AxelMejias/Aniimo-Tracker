import { describe, expect, it } from 'vitest'
import { esCredenciales } from './validacion'

describe('esCredenciales', () => {
  it('acepta nombreUsuario y contrasena como strings dentro de los largos', () => {
    expect(esCredenciales({ nombreUsuario: 'axel', contrasena: 'una-clave-larga' })).toBe(true)
  })

  it('acepta los largos maximos exactos', () => {
    expect(esCredenciales({ nombreUsuario: 'a'.repeat(64), contrasena: 'b'.repeat(128) })).toBe(true)
  })

  it('acepta strings vacios: el backend decide su validez', () => {
    expect(esCredenciales({ nombreUsuario: '', contrasena: '' })).toBe(true)
  })

  it('rechaza una clave extra', () => {
    expect(esCredenciales({ nombreUsuario: 'axel', contrasena: 'x', extra: 1 })).toBe(false)
  })

  it('rechaza una clave faltante', () => {
    expect(esCredenciales({ nombreUsuario: 'axel' })).toBe(false)
    expect(esCredenciales({ contrasena: 'x' })).toBe(false)
    expect(esCredenciales({})).toBe(false)
  })

  it('rechaza tipos incorrectos', () => {
    expect(esCredenciales({ nombreUsuario: 42, contrasena: 'x' })).toBe(false)
    expect(esCredenciales({ nombreUsuario: 'axel', contrasena: null })).toBe(false)
    expect(esCredenciales({ nombreUsuario: ['axel'], contrasena: 'x' })).toBe(false)
  })

  it('rechaza valores que no son objetos planos', () => {
    expect(esCredenciales(null)).toBe(false)
    expect(esCredenciales(undefined)).toBe(false)
    expect(esCredenciales('axel')).toBe(false)
    expect(esCredenciales(['axel', 'x'])).toBe(false)
    expect(esCredenciales(new Map())).toBe(false)
  })

  it('rechaza strings demasiado largos', () => {
    expect(esCredenciales({ nombreUsuario: 'a'.repeat(65), contrasena: 'x' })).toBe(false)
    expect(esCredenciales({ nombreUsuario: 'axel', contrasena: 'x'.repeat(129) })).toBe(false)
  })

  it('rechaza claves simbolicas adicionales', () => {
    const valor = { nombreUsuario: 'axel', contrasena: 'x', [Symbol('s')]: 1 }
    expect(esCredenciales(valor)).toBe(false)
  })
})
