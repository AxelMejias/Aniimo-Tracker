import { describe, expect, it } from 'vitest'
import { RESUMEN_DE_IRISALIS } from '../../../../../tests/fixtures/apiFalsa'
import type { SlotDeTeam } from '../../../../shared/teams'
import { cartasDelAbanico } from './abanicoDeCartas'

function slots(ocupados: readonly boolean[]): SlotDeTeam[] {
  return ocupados.map((lleno, i) => ({ slot: i + 1, aniimo: lleno ? RESUMEN_DE_IRISALIS : null }))
}

describe('cartasDelAbanico', () => {
  it('con cuatro slots llenos da cuatro cartas c1 a c4 en orden de slot', () => {
    const { cantidad, cartas } = cartasDelAbanico(slots([true, true, true, true]))
    expect(cantidad).toBe(4)
    expect(cartas.map((c) => `${c.slot}:${c.posicion}`)).toEqual(['1:c1', '2:c2', '3:c3', '4:c4'])
    expect(cartas.every((c) => c.aniimo !== null)).toBe(true)
  })

  it('los slots vacios tambien son cartas, con aniimo null', () => {
    const { cantidad, cartas } = cartasDelAbanico(slots([true, false, true, false]))
    expect(cantidad).toBe(4)
    expect(cartas.map((c) => c.aniimo === null)).toEqual([false, true, false, true])
  })

  it('con menos slots usa la cantidad que hay', () => {
    expect(cartasDelAbanico(slots([true, false])).cantidad).toBe(2)
    expect(cartasDelAbanico(slots([true])).cantidad).toBe(1)
  })

  it('sin slots no hay cartas y con mas de cuatro corta en cuatro', () => {
    expect(cartasDelAbanico([]).cartas).toEqual([])
    const { cantidad, cartas } = cartasDelAbanico(slots([true, true, true, true, true]))
    expect(cantidad).toBe(4)
    expect(cartas).toHaveLength(4)
  })
})
