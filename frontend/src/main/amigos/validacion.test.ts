import { describe, expect, it } from 'vitest'
import {
  esPedidoBuscar,
  esPedidoDeSlotDeAmigo,
  esPedidoDeUsuario
} from './validacion'

const USUARIO_ID = '7a1d3c52-6b0e-4f3a-8d21-5c9e4b7a0f11'
const TEAM_ID = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'

describe('esPedidoBuscar', () => {
  it.each(['bruno', 'Bru_no9', 'abc', 'x'.repeat(32)])('acepta %s', (nombreUsuario) => {
    expect(esPedidoBuscar({ nombreUsuario })).toBe(true)
  })

  it.each([
    ['corto', { nombreUsuario: 'ab' }],
    ['largo', { nombreUsuario: 'x'.repeat(33) }],
    ['con espacios', { nombreUsuario: 'a b c' }],
    ['con guion', { nombreUsuario: 'bru-no' }],
    ['numero', { nombreUsuario: 12345 }],
    ['null', { nombreUsuario: null }],
    ['sin clave', {}],
    ['clave extra', { nombreUsuario: 'bruno', extra: 1 }],
    ['no objeto', 'bruno'],
    ['null total', null],
    ['arreglo', ['bruno']]
  ])('rechaza %s', (_caso, valor) => {
    expect(esPedidoBuscar(valor)).toBe(false)
  })
})

describe('esPedidoDeUsuario', () => {
  it('acepta un usuarioId UUID', () => {
    expect(esPedidoDeUsuario({ usuarioId: USUARIO_ID })).toBe(true)
    expect(esPedidoDeUsuario({ usuarioId: USUARIO_ID.toUpperCase() })).toBe(true)
  })

  it.each([
    ['no UUID', { usuarioId: 'bruno' }],
    ['numero', { usuarioId: 5 }],
    ['sin clave', {}],
    ['clave extra', { usuarioId: USUARIO_ID, teamId: TEAM_ID }],
    ['null', null]
  ])('rechaza %s', (_caso, valor) => {
    expect(esPedidoDeUsuario(valor)).toBe(false)
  })
})

describe('esPedidoDeSlotDeAmigo', () => {
  it.each([1, 2, 3, 4])('acepta el slot %i', (slot) => {
    expect(esPedidoDeSlotDeAmigo({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot })).toBe(true)
  })

  it.each([
    ['slot 0', { usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 0 }],
    ['slot 5', { usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 5 }],
    ['slot string', { usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: '1' }],
    ['slot decimal', { usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1.5 }],
    ['usuarioId invalido', { usuarioId: 'x', teamId: TEAM_ID, slot: 1 }],
    ['teamId invalido', { usuarioId: USUARIO_ID, teamId: 'x', slot: 1 }],
    ['sin slot', { usuarioId: USUARIO_ID, teamId: TEAM_ID }],
    ['clave extra', { usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1, extra: true }],
    ['null', null]
  ])('rechaza %s', (_caso, valor) => {
    expect(esPedidoDeSlotDeAmigo(valor)).toBe(false)
  })
})
