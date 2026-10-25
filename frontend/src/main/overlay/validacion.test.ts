import { describe, expect, it } from 'vitest'
import { esPedidoAbrirOverlay } from './validacion'

const T1 = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'

describe('esPedidoAbrirOverlay', () => {
  it('acepta un teamId UUID', () => {
    expect(esPedidoAbrirOverlay({ teamId: T1 })).toBe(true)
    expect(esPedidoAbrirOverlay({ teamId: T1.toUpperCase() })).toBe(true)
  })

  it.each([
    ['uuid invalido', { teamId: 'abc' }],
    ['clave extra', { teamId: T1, extra: 1 }],
    ['sin clave', {}],
    ['teamId numerico', { teamId: 5 }],
    ['null', null],
    ['string', T1],
    ['array', [T1]],
    ['undefined', undefined]
  ])('rechaza %s', (_n, valor) => {
    expect(esPedidoAbrirOverlay(valor)).toBe(false)
  })
})
