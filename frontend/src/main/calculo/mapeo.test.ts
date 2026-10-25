import { describe, expect, it } from 'vitest'
import {
  catalogoDeApiDeReferencia,
  catalogoDeReferencia,
  pedidoDeApiDeReferencia,
  pedidoDeReferencia,
  sugerenciaDeApiDeReferencia,
  sugerenciaDeReferencia
} from '../../../tests/fixtures/calculo'
import { omitir } from '../../../tests/fixtures/ficha'
import { RespuestaInvalida } from '../teams/mapeo'
import { catalogoDeApi, pedidoAApi, sugerenciaDeApi } from './mapeo'

function conStat(stat: string, cambios: Record<string, unknown>): Record<string, unknown> {
  const api = sugerenciaDeApiDeReferencia()
  const stats = api.stats as Record<string, Record<string, unknown>>
  return { ...api, stats: { ...stats, [stat]: { ...stats[stat], ...cambios } } }
}

function conCp(cambios: Record<string, unknown>): Record<string, unknown> {
  const api = sugerenciaDeApiDeReferencia()
  return { ...api, cp: { ...(api.cp as Record<string, unknown>), ...cambios } }
}

describe('pedidoAApi', () => {
  it('traduce el pedido a snake_case', () => {
    expect(pedidoAApi(pedidoDeReferencia())).toEqual(pedidoDeApiDeReferencia())
  })

  it('conserva null en personalidad y objeto sin elegir, y la lista vacia', () => {
    const api = pedidoAApi({
      ...pedidoDeReferencia(),
      personalidad: null,
      objetos: [{ posicion: 'alternativo', objetoId: null, nivel: 4 }]
    })
    expect(api.personalidad).toBeNull()
    expect(api.objetos).toEqual([{ posicion: 'alternativo', objeto_id: null, nivel: 4 }])
    expect(pedidoAApi({ ...pedidoDeReferencia(), objetos: [] }).objetos).toEqual([])
  })
})

describe('catalogoDeApi', () => {
  it('traduce el catalogo de ejemplo a camelCase', () => {
    expect(catalogoDeApi(catalogoDeApiDeReferencia())).toEqual(catalogoDeReferencia())
  })

  it.each([
    ['es_ejemplo string', { es_ejemplo: 'true' }],
    ['version numero', { version: 1 }],
    ['especies no lista', { especies: 'a' }],
    ['especie sin nombre', { especies: [{ id: 'a' }] }],
    ['sin_datos con numero', { sin_datos: [1] }],
    ['sin objetos', { objetos: undefined }]
  ])('rechaza %s', (_caso, cambios) => {
    expect(() => catalogoDeApi({ ...catalogoDeApiDeReferencia(), ...cambios })).toThrow(
      RespuestaInvalida
    )
  })
})

describe('sugerenciaDeApi', () => {
  it('traduce stats, CP y objetos a camelCase', () => {
    expect(sugerenciaDeApi(sugerenciaDeApiDeReferencia())).toEqual(sugerenciaDeReferencia())
  })

  it('conserva los nulos y los motivos', () => {
    const api = conStat('ps', { valor: null, valor_con_objetos: null, motivo: 'fuera-de-rango' })
    const sugerencia = sugerenciaDeApi({
      ...api,
      cp: { ...(api.cp as object), valor: null, valor_con_objetos: null, motivo: 'sin-datos' },
      objetos: [{ posicion: 'equipado', aplicado: false, nota: 'objeto-desconocido' }],
      sin_datos: ['cp']
    })
    expect(sugerencia.stats.ps).toMatchObject({
      valor: null,
      valorConObjetos: null,
      motivo: 'fuera-de-rango'
    })
    expect(sugerencia.cp.motivo).toBe('sin-datos')
    expect(sugerencia.objetos[0]).toEqual({
      posicion: 'equipado',
      aplicado: false,
      nota: 'objeto-desconocido'
    })
    expect(sugerencia.sinDatos).toEqual(['cp'])
  })

  it.each([
    ['valor string', conStat('atq', { valor: '458' })],
    ['valor_con_objetos string', conStat('atq', { valor_con_objetos: '509' })],
    ['valor decimal', conStat('atq', { valor: 458.5 })],
    ['cp.valor_con_objetos string', conCp({ valor_con_objetos: '629' })],
    ['cp.valor undefined', conCp({ valor: undefined })],
    ['aproximado string', conStat('atq', { aproximado: 'si' })],
    ['motivo desconocido', conStat('atq', { motivo: 'misterio' })],
    ['motivo numero', conCp({ motivo: 5 })],
    ['desglose no lista', conStat('atq', { desglose: 'x' })],
    ['termino sin valor numerico', conStat('atq', { desglose: [{ origen: 'a', detalle: 'b', tipo: 'c', valor: 'x' }] })],
    [
      'falta un stat',
      {
        ...sugerenciaDeApiDeReferencia(),
        stats: omitir(sugerenciaDeApiDeReferencia().stats as Record<string, unknown>, 'quiebre')
      }
    ],
    ['nota desconocida', { ...sugerenciaDeApiDeReferencia(), objetos: [{ posicion: 'equipado', aplicado: false, nota: 'rota' }] }],
    ['posicion desconocida', { ...sugerenciaDeApiDeReferencia(), objetos: [{ posicion: 'mochila', aplicado: true, nota: null }] }],
    ['aplicado string', { ...sugerenciaDeApiDeReferencia(), objetos: [{ posicion: 'equipado', aplicado: 'si', nota: null }] }],
    ['es_ejemplo ausente', { ...sugerenciaDeApiDeReferencia(), es_ejemplo: undefined }],
    ['no es objeto', 'hola']
  ])('rechaza %s', (_caso, api) => {
    expect(() => sugerenciaDeApi(api)).toThrow(RespuestaInvalida)
  })
})
