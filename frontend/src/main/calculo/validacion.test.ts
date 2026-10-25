import { describe, expect, it } from 'vitest'
import {
  pedidoDePotencialDeReferencia,
  pedidoDeReferencia
} from '../../../tests/fixtures/calculo'
import { omitir } from '../../../tests/fixtures/ficha'
import { esPedidoCalcular, esPedidoPotencial } from './validacion'

function con(cambios: Record<string, unknown>): unknown {
  return { ...pedidoDeReferencia(), ...cambios }
}

function conPotencial(stat: string, valor: unknown): unknown {
  return con({ potenciales: { ...pedidoDeReferencia().potenciales, [stat]: valor } })
}

const OBJETO_EQUIPADO = { posicion: 'equipado', objetoId: 'ejemplo-objeto-x', nivel: 1 }
const OBJETO_ALTERNATIVO = { posicion: 'alternativo', objetoId: null, nivel: 3 }

describe('esPedidoCalcular valido', () => {
  it.each([
    ['completo', pedidoDeReferencia()],
    ['sin personalidad', con({ personalidad: null })],
    ['sin objetos', con({ objetos: [] })],
    ['objeto sin elegir', con({ objetos: [{ ...OBJETO_EQUIPADO, objetoId: null }] })],
    ['dos objetos en posiciones distintas', con({ objetos: [OBJETO_EQUIPADO, OBJETO_ALTERNATIVO] })],
    ['limites superiores', con({ nivel: 999, etapaEstrella: 7, especieId: 'a'.repeat(50) })],
    ['limites inferiores', con({ nivel: 1, etapaEstrella: 0, especieId: 'a' })],
    ['potencial en el tope', conPotencial('ps', 20)]
  ])('acepta %s', (_caso, pedido) => {
    expect(esPedidoCalcular(pedido)).toBe(true)
  })
})

describe('esPedidoCalcular invalido', () => {
  it.each([
    ['nivel string', con({ nivel: '30' })],
    ['nivel 0', con({ nivel: 0 })],
    ['nivel 1000', con({ nivel: 1000 })],
    ['nivel decimal', con({ nivel: 30.5 })],
    ['nivel NaN', con({ nivel: Number.NaN })],
    ['potencial 21', conPotencial('atq', 21)],
    ['potencial decimal', conPotencial('atq', 1.5)],
    ['potencial negativo', conPotencial('atq', -1)],
    ['potencial string', conPotencial('atq', '5')],
    [
      'stat de menos',
      con({ potenciales: { ps: 0, atq: 0, def_fisica: 0, def_magica: 0, regen: 0 } })
    ],
    [
      'stat de mas',
      con({ potenciales: { ...pedidoDeReferencia().potenciales, velocidad: 1 } })
    ],
    ['potenciales null', con({ potenciales: null })],
    ['especieId con ruta', con({ especieId: '../x' })],
    ['especieId de 51 caracteres', con({ especieId: 'a'.repeat(51) })],
    ['especieId con mayusculas', con({ especieId: 'Ejemplo' })],
    ['especieId vacio', con({ especieId: '' })],
    ['especieId numero', con({ especieId: 5 })],
    ['etapa 8', con({ etapaEstrella: 8 })],
    ['etapa negativa', con({ etapaEstrella: -1 })],
    ['etapa null', con({ etapaEstrella: null })],
    ['etapa string', con({ etapaEstrella: '1' })],
    ['etapa decimal', con({ etapaEstrella: 1.5 })],
    ['estrellaActual en lugar de etapaEstrella', { ...omitir(pedidoDeReferencia(), 'etapaEstrella'), estrellaActual: 1 }],
    ['estrellaActual ademas de etapaEstrella', con({ estrellaActual: 1 })],
    ['personalidad invalida', con({ personalidad: 'XXXX' })],
    ['personalidad minuscula', con({ personalidad: 'enfj' })],
    ['personalidad undefined', con({ personalidad: undefined })],
    [
      'tres objetos',
      con({ objetos: [OBJETO_EQUIPADO, OBJETO_ALTERNATIVO, OBJETO_ALTERNATIVO] })
    ],
    ['dos equipados', con({ objetos: [OBJETO_EQUIPADO, { ...OBJETO_EQUIPADO, nivel: 2 }] })],
    ['objetoId con ruta', con({ objetos: [{ ...OBJETO_EQUIPADO, objetoId: '../y' }] })],
    ['nivel de objeto 0', con({ objetos: [{ ...OBJETO_EQUIPADO, nivel: 0 }] })],
    ['nivel de objeto 100', con({ objetos: [{ ...OBJETO_EQUIPADO, nivel: 100 }] })],
    ['posicion desconocida', con({ objetos: [{ ...OBJETO_EQUIPADO, posicion: 'mochila' }] })],
    ['clave extra en objeto', con({ objetos: [{ ...OBJETO_EQUIPADO, extra: 1 }] })],
    ['objetos no es lista', con({ objetos: 'ninguno' })],
    ['clave extra', con({ extra: 1 })],
    ['falta una clave', omitir(pedidoDeReferencia(), 'nivel')],
    ['null', null],
    ['arreglo', []],
    ['string', 'pedido']
  ])('rechaza %s', (_caso, pedido) => {
    expect(esPedidoCalcular(pedido)).toBe(false)
  })
})


function conPotencial2(cambios: Record<string, unknown>): unknown {
  return { ...pedidoDePotencialDeReferencia(), ...cambios }
}

describe('esPedidoPotencial valido', () => {
  it.each([
    ['completo', pedidoDePotencialDeReferencia()],
    ['sin personalidad', conPotencial2({ personalidad: null })],
    ['con fecha de parche', conPotencial2({ fechaParche: '2026-10-26' })],
    ['objeto equipado', conPotencial2({ objetoEquipado: { objetoId: 'ejemplo-objeto-x', nivel: 2 } })],
    ['objeto sin elegir', conPotencial2({ objetoEquipado: { objetoId: null, nivel: 1 } })],
    ['usados iguales al total', conPotencial2({ despertaresUsados: 43, despertaresTotal: 43 })],
    ['limites inferiores', conPotencial2({ nivel: 1, etapaEstrella: 0, despertaresUsados: 0, despertaresTotal: 0 })],
    ['limites superiores', conPotencial2({ nivel: 999, etapaEstrella: 7, despertaresUsados: 9999, despertaresTotal: 9999 })],
    ['fecha limite inferior', conPotencial2({ fechaParche: '2020-01-01' })],
    ['fecha limite superior', conPotencial2({ fechaParche: '2099-12-31' })]
  ])('acepta %s', (_caso, pedido) => {
    expect(esPedidoPotencial(pedido)).toBe(true)
  })
})

describe('esPedidoPotencial invalido', () => {
  it.each([
    ['nivel string', conPotencial2({ nivel: '60' })],
    ['nivel 0', conPotencial2({ nivel: 0 })],
    ['nivel 1000', conPotencial2({ nivel: 1000 })],
    ['etapa 8', conPotencial2({ etapaEstrella: 8 })],
    ['etapa null', conPotencial2({ etapaEstrella: null })],
    ['etapa string', conPotencial2({ etapaEstrella: '6' })],
    ['potencial 21', conPotencial2({ potenciales: { ...pedidoDePotencialDeReferencia().potenciales, atq: 21 } })],
    ['stat de menos', conPotencial2({ potenciales: { ps: 0, atq: 0, def_fisica: 0, def_magica: 0, regen: 0 } })],
    ['personalidad invalida', conPotencial2({ personalidad: 'XXXX' })],
    ['usados mayor que total', conPotencial2({ despertaresUsados: 44, despertaresTotal: 43 })],
    ['usados negativo', conPotencial2({ despertaresUsados: -1 })],
    ['total 10000', conPotencial2({ despertaresTotal: 10000 })],
    ['usados decimal', conPotencial2({ despertaresUsados: 1.5 })],
    ['fecha mes 13', conPotencial2({ fechaParche: '2026-13-01' })],
    ['fecha inexistente', conPotencial2({ fechaParche: '2026-02-30' })],
    ['fecha local', conPotencial2({ fechaParche: '26/10/2026' })],
    ['fecha anterior al rango', conPotencial2({ fechaParche: '2019-12-31' })],
    ['fecha numerica', conPotencial2({ fechaParche: 20261026 })],
    ['sin fechaParche', omitir(pedidoDePotencialDeReferencia(), 'fechaParche')],
    ['objeto con clave extra', conPotencial2({ objetoEquipado: { objetoId: null, nivel: 1, extra: 1 } })],
    ['objeto con id con ruta', conPotencial2({ objetoEquipado: { objetoId: '../y', nivel: 1 } })],
    ['objeto con nivel 0', conPotencial2({ objetoEquipado: { objetoId: null, nivel: 0 } })],
    ['objeto con nivel 100', conPotencial2({ objetoEquipado: { objetoId: null, nivel: 100 } })],
    ['objeto sin nivel', conPotencial2({ objetoEquipado: { objetoId: null } })],
    ['objeto como lista', conPotencial2({ objetoEquipado: [] })],
    ['sin objetoEquipado', omitir(pedidoDePotencialDeReferencia(), 'objetoEquipado')],
    ['clave extra', conPotencial2({ extra: 1 })],
    ['estrellaActual', conPotencial2({ estrellaActual: 2 })],
    ['null', null],
    ['arreglo', []]
  ])('rechaza %s', (_caso, pedido) => {
    expect(esPedidoPotencial(pedido)).toBe(false)
  })
})
