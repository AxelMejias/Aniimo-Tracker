import { describe, expect, it } from 'vitest'
import { esEtapaDeEstrella, esFechaDeParche } from './parche'

describe('esFechaDeParche', () => {
  it.each(['2020-01-01', '2026-10-26', '2099-12-31', '2028-02-29'])('acepta %s', (fecha) => {
    expect(esFechaDeParche(fecha)).toBe(true)
  })

  it.each([
    '2019-12-31',
    '2100-01-01',
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '26/10/2026',
    '2026-1-5',
    '2026-10-26 ',
    ''
  ])('rechaza %s', (fecha) => {
    expect(esFechaDeParche(fecha)).toBe(false)
  })

  it.each([null, undefined, 20261026, {}, ['2026-10-26']])('rechaza lo que no es texto: %s', (v) => {
    expect(esFechaDeParche(v)).toBe(false)
  })
})

describe('esEtapaDeEstrella', () => {
  it.each([0, 1, 7])('acepta %s', (etapa) => {
    expect(esEtapaDeEstrella(etapa)).toBe(true)
  })

  it.each([-1, 8, 6.5, Number.NaN, '6', null, undefined, true])('rechaza %s', (etapa) => {
    expect(esEtapaDeEstrella(etapa)).toBe(false)
  })
})
