import { describe, expect, it } from 'vitest'
import { posicionesDelAbanico } from './abanico'

const IDS = ['a', 'b', 'c', 'd', 'e']

function resumen(ids: readonly string[], portada: string | null, abierto: boolean): string[] {
  return posicionesDelAbanico(ids, portada, abierto).map(
    (p) => `${p.teamId}:${p.numero}:${p.posicion}:${p.enfocable ? 'si' : 'no'}`
  )
}

describe('posicionesDelAbanico', () => {
  it('con cinco teams y la portada primera numera en orden y reparte p1 a p4 al resto', () => {
    expect(resumen(IDS, 'a', true)).toEqual([
      'a:1:p0:si',
      'b:2:p1:si',
      'c:3:p2:si',
      'd:4:p3:si',
      'e:5:p4:si'
    ])
  })

  it('la portada en otra posicion conserva su numero y el resto sigue en orden', () => {
    expect(resumen(IDS, 'c', true)).toEqual([
      'a:1:p1:si',
      'b:2:p2:si',
      'c:3:p0:si',
      'd:4:p3:si',
      'e:5:p4:si'
    ])
  })

  it('cerrado solo la portada es enfocable', () => {
    expect(resumen(IDS, 'c', false)).toEqual([
      'a:1:p1:no',
      'b:2:p2:no',
      'c:3:p0:si',
      'd:4:p3:no',
      'e:5:p4:no'
    ])
  })

  it('con cuatro, tres y dos teams usa solo las posiciones que hacen falta', () => {
    expect(resumen(['a', 'b', 'c', 'd'], 'd', true).map((r) => r.split(':')[2])).toEqual([
      'p1',
      'p2',
      'p3',
      'p0'
    ])
    expect(resumen(['a', 'b', 'c'], 'b', true).map((r) => r.split(':')[2])).toEqual([
      'p1',
      'p0',
      'p2'
    ])
    expect(resumen(['a', 'b'], 'a', true).map((r) => r.split(':')[2])).toEqual(['p0', 'p1'])
  })

  it('con un solo team es la portada y siempre es enfocable', () => {
    expect(resumen(['a'], 'a', true)).toEqual(['a:1:p0:si'])
    expect(resumen(['a'], 'a', false)).toEqual(['a:1:p0:si'])
  })

  it('sin portada o con una portada que no esta en el grupo usa el primer team', () => {
    expect(resumen(['a', 'b'], null, false)).toEqual(['a:1:p0:si', 'b:2:p1:no'])
    expect(resumen(['a', 'b'], 'zzz', false)).toEqual(['a:1:p0:si', 'b:2:p1:no'])
  })

  it('un grupo vacio no devuelve posiciones', () => {
    expect(posicionesDelAbanico([], null, true)).toEqual([])
  })
})
