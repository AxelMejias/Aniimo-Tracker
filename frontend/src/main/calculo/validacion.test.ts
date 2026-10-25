import { describe, expect, it } from 'vitest'
import { pedidoDeReferencia } from '../../../tests/fixtures/calculo'
import { omitir } from '../../../tests/fixtures/ficha'
import { esPedidoCalcular } from './validacion'

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
    ['limites superiores', con({ nivel: 999, estrellaActual: 99, especieId: 'a'.repeat(50) })],
    ['limites inferiores', con({ nivel: 1, estrellaActual: 0, especieId: 'a' })],
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
    ['estrella 100', con({ estrellaActual: 100 })],
    ['estrella negativa', con({ estrellaActual: -1 })],
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
