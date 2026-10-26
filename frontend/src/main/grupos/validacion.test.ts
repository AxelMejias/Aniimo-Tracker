import { describe, expect, it } from 'vitest'
import {
  esPedidoCrearGrupo,
  esPedidoDeGrupo,
  esPedidoDeTeamEnGrupo,
  esPedidoElegirPortadaDeGrupo,
  esPedidoOrdenarGrupos,
  esPedidoOrdenarSueltos,
  esPedidoOrdenarTeams,
  esPedidoRenombrarGrupo
} from './validacion'

const G1 = '8b0e5d6a-3c21-4f7e-a1d4-9e2c7b6f0a13'
const T1 = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'

function ids(cantidad: number): string[] {
  return Array.from(
    { length: cantidad },
    (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
  )
}

describe('esPedidoCrearGrupo', () => {
  it.each(['Buildeado', 'x'.repeat(50)])('acepta el nombre %s', (nombre) => {
    expect(esPedidoCrearGrupo({ nombre })).toBe(true)
  })

  it.each([
    ['nombre de 51', { nombre: 'x'.repeat(51) }],
    ['nombre numerico', { nombre: 5 }],
    ['sin nombre', {}],
    ['nombre nulo', { nombre: null }],
    ['clave extra', { nombre: 'a', extra: 1 }],
    ['null', null]
  ])('rechaza %s', (_caso, valor) => {
    expect(esPedidoCrearGrupo(valor)).toBe(false)
  })
})

describe('esPedidoRenombrarGrupo', () => {
  it('acepta grupoId UUID y nombre', () => {
    expect(esPedidoRenombrarGrupo({ grupoId: G1, nombre: 'Homeland' })).toBe(true)
  })

  it.each([
    ['grupoId invalido', { grupoId: 'abc', nombre: 'a' }],
    ['sin nombre', { grupoId: G1 }],
    ['nombre largo', { grupoId: G1, nombre: 'x'.repeat(51) }],
    ['clave extra', { grupoId: G1, nombre: 'a', extra: 1 }]
  ])('rechaza %s', (_caso, valor) => {
    expect(esPedidoRenombrarGrupo(valor)).toBe(false)
  })
})

describe('esPedidoElegirPortadaDeGrupo', () => {
  it.each([T1, null])('acepta teamId %s', (teamId) => {
    expect(esPedidoElegirPortadaDeGrupo({ grupoId: G1, teamId })).toBe(true)
  })

  it.each([
    ['teamId invalido', { grupoId: G1, teamId: 'abc' }],
    ['teamId numerico', { grupoId: G1, teamId: 3 }],
    ['sin teamId', { grupoId: G1 }],
    ['teamId undefined', { grupoId: G1, teamId: undefined }],
    ['grupoId nulo', { grupoId: null, teamId: T1 }],
    ['clave extra', { grupoId: G1, teamId: T1, extra: 1 }]
  ])('rechaza %s', (_caso, valor) => {
    expect(esPedidoElegirPortadaDeGrupo(valor)).toBe(false)
  })
})

describe('esPedidoDeGrupo y esPedidoDeTeamEnGrupo', () => {
  it('aceptan los ids UUID con exactamente las claves esperadas', () => {
    expect(esPedidoDeGrupo({ grupoId: G1 })).toBe(true)
    expect(esPedidoDeTeamEnGrupo({ grupoId: G1, teamId: T1 })).toBe(true)
  })

  it.each([
    ['grupoId invalido', { grupoId: 'abc', teamId: T1 }],
    ['teamId invalido', { grupoId: G1, teamId: 'abc' }],
    ['sin teamId', { grupoId: G1 }],
    ['clave extra', { grupoId: G1, teamId: T1, extra: 1 }],
    ['null', null]
  ])('esPedidoDeTeamEnGrupo rechaza %s', (_caso, valor) => {
    expect(esPedidoDeTeamEnGrupo(valor)).toBe(false)
  })

  it.each([{ grupoId: 'abc' }, { grupoId: G1, extra: 1 }, {}, null])(
    'esPedidoDeGrupo rechaza %j',
    (valor) => {
      expect(esPedidoDeGrupo(valor)).toBe(false)
    }
  )
})

describe.each([
  ['esPedidoOrdenarGrupos', 'grupoIds', 4, (v: unknown) => esPedidoOrdenarGrupos(v), {}],
  [
    'esPedidoOrdenarTeams',
    'teamIds',
    5,
    (v: unknown) => esPedidoOrdenarTeams(v),
    { grupoId: G1 }
  ],
  ['esPedidoOrdenarSueltos', 'teamIds', 20, (v: unknown) => esPedidoOrdenarSueltos(v), {}]
])('%s', (_nombre, clave, maximo, validar, base) => {
  it('acepta de 1 hasta el maximo de ids distintos', () => {
    expect(validar({ ...base, [clave]: ids(1) })).toBe(true)
    expect(validar({ ...base, [clave]: ids(maximo) })).toBe(true)
  })

  it.each([
    ['lista vacia', []],
    ['un id repetido', [T1, T1]],
    ['un id que no es UUID', ['abc']],
    ['un numero', [1]],
    ['un null', [null]],
    ['texto en vez de lista', T1]
  ])('rechaza %s', (_caso, lista) => {
    expect(validar({ ...base, [clave]: lista })).toBe(false)
  })

  it('rechaza una lista mas larga que el maximo', () => {
    expect(validar({ ...base, [clave]: ids(maximo + 1) })).toBe(false)
  })

  it('rechaza claves extra, claves que faltan y valores que no son objetos', () => {
    expect(validar({ ...base, [clave]: ids(1), extra: 1 })).toBe(false)
    expect(validar(base)).toBe(false)
    expect(validar(null)).toBe(false)
    expect(validar(ids(1))).toBe(false)
  })
})

describe('esPedidoOrdenarTeams exige el grupo', () => {
  it.each([{ teamIds: [T1] }, { grupoId: 'abc', teamIds: [T1] }])('rechaza %j', (valor) => {
    expect(esPedidoOrdenarTeams(valor)).toBe(false)
  })
})
