import { describe, expect, it } from 'vitest'
import {
  catalogoDeApiDeReferencia,
  catalogoDeReferencia,
  pedidoDeApiDeReferencia,
  pedidoDePotencialDeApiDeReferencia,
  pedidoDePotencialDeReferencia,
  pedidoDeReferencia,
  potencialDeApiDeReferencia,
  potencialDeReferencia,
  sugerenciaDeApiDeReferencia,
  sugerenciaDeReferencia
} from '../../../tests/fixtures/calculo'
import { omitir } from '../../../tests/fixtures/ficha'
import { RespuestaInvalida } from '../teams/mapeo'
import {
  catalogoDeApi,
  pedidoAApi,
  pedidoDePotencialAApi,
  potencialDeApi,
  sugerenciaDeApi
} from './mapeo'

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

  it('envia etapa_estrella y nunca estrella_actual', () => {
    const api = pedidoAApi({ ...pedidoDeReferencia(), etapaEstrella: 7 })
    expect(api.etapa_estrella).toBe(7)
    expect(api).not.toHaveProperty('estrella_actual')
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
    ['sin formato', { formato: undefined }],
    ['formato string', { formato: '2' }],
    ['estimacion_verificada string', { estimacion_verificada: 'false' }],
    ['sin estimacion_verificada', { estimacion_verificada: undefined }],
    ['fecha_parche con otro formato', { fecha_parche: '23/09/2026' }],
    ['fecha_parche null', { fecha_parche: null }],
    ['cambios_conocidos no lista', { cambios_conocidos: 'x' }],
    ['cambio con confianza desconocida', { cambios_conocidos: [{ fecha: '2026-09-23', descripcion: 'x', confianza: 'seguro' }] }],
    ['cambio con fecha invalida', { cambios_conocidos: [{ fecha: '2026-02-30', descripcion: 'x', confianza: 'fan' }] }],
    ['cambio sin descripcion', { cambios_conocidos: [{ fecha: '2026-09-23', confianza: 'fan' }] }],
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
    ['estimacion_verificada ausente', { ...sugerenciaDeApiDeReferencia(), estimacion_verificada: undefined }],
    ['estimacion_verificada string', { ...sugerenciaDeApiDeReferencia(), estimacion_verificada: 'false' }],
    ['fecha_parche ausente', { ...sugerenciaDeApiDeReferencia(), fecha_parche: undefined }],
    ['fecha_parche invalida', { ...sugerenciaDeApiDeReferencia(), fecha_parche: '2026-02-30' }],
    ['no es objeto', 'hola']
  ])('rechaza %s', (_caso, api) => {
    expect(() => sugerenciaDeApi(api)).toThrow(RespuestaInvalida)
  })
})


function conPotencialDeStat(stat: string, cambios: Record<string, unknown>): Record<string, unknown> {
  const api = potencialDeApiDeReferencia()
  const potencial = api.potencial as Record<string, unknown>
  const stats = potencial.stats as Record<string, Record<string, unknown>>
  return {
    ...api,
    potencial: { ...potencial, stats: { ...stats, [stat]: { ...stats[stat], ...cambios } } }
  }
}

function conSeccion(seccion: string, cambios: Record<string, unknown>): Record<string, unknown> {
  const api = potencialDeApiDeReferencia()
  return { ...api, [seccion]: { ...(api[seccion] as Record<string, unknown>), ...cambios } }
}

describe('pedidoDePotencialAApi', () => {
  it('traduce el pedido a snake_case', () => {
    expect(pedidoDePotencialAApi(pedidoDePotencialDeReferencia())).toEqual(
      pedidoDePotencialDeApiDeReferencia()
    )
  })

  it('traduce el objeto equipado, la personalidad nula y la fecha', () => {
    const api = pedidoDePotencialAApi({
      ...pedidoDePotencialDeReferencia(),
      personalidad: null,
      objetoEquipado: { objetoId: 'ejemplo-objeto-x', nivel: 2 },
      fechaParche: '2026-10-26'
    })
    expect(api.personalidad).toBeNull()
    expect(api.objeto_equipado).toEqual({ objeto_id: 'ejemplo-objeto-x', nivel: 2 })
    expect(api.fecha_parche).toBe('2026-10-26')
  })
})

describe('potencialDeApi', () => {
  it('traduce el potencial de Irisalis a camelCase', () => {
    expect(potencialDeApi(potencialDeApiDeReferencia())).toEqual(potencialDeReferencia())
  })

  it('traduce un resultado con secciones nulas y objeto no aplicado', () => {
    const api = {
      ...potencialDeApiDeReferencia(),
      potencial: null,
      despertar: null,
      personalidad: null,
      objeto: { aplicado: false, nota: 'sin-bono-de-potencial' },
      version_desconocida: false,
      avisos: [],
      sin_datos: ['potencial', 'despertar']
    }
    expect(potencialDeApi(api)).toMatchObject({
      potencial: null,
      despertar: null,
      personalidad: null,
      objeto: { aplicado: false, nota: 'sin-bono-de-potencial' },
      versionDesconocida: false,
      avisos: [],
      sinDatos: ['potencial', 'despertar']
    })
  })

  it('conserva un slot de personalidad sin datos', () => {
    const api = {
      ...potencialDeApiDeReferencia(),
      personalidad: [
        { letra: 'P', nombre: null, letra_confirmada: false, confianza: null, bonos: [] }
      ]
    }
    expect(potencialDeApi(api).personalidad).toEqual([
      { letra: 'P', nombre: null, letraConfirmada: false, confianza: null, bonos: [] }
    ])
  })

  it.each([
    ['via_despertar desconocida', conPotencialDeStat('atq', { via_despertar: 'quizas' })],
    ['via_despertar numerica', conPotencialDeStat('atq', { via_despertar: 1 })],
    ['n string', conPotencialDeStat('atq', { n: '22' })],
    ['saltos decimal', conPotencialDeStat('atq', { saltos: 1.5 })],
    ['porcentaje_por_puntos string', conPotencialDeStat('atq', { porcentaje_por_puntos: '1' })],
    ['faltan los stats', conSeccion('potencial', { stats: {} })],
    ['confianza de potencial desconocida', conSeccion('potencial', { confianza: 'seguro' })],
    ['cuenta_estrella string', conSeccion('potencial', { cuenta_estrella: 'si' })],
    ['salto_cada ausente', conSeccion('potencial', { salto_cada: undefined })],
    ['cupo_sugerido string', conSeccion('despertar', { cupo_sugerido: '43' })],
    ['confianza de despertar desconocida', conSeccion('despertar', { confianza: 'x' })],
    ['desglose de cupo no lista', conSeccion('despertar', { desglose: 'x' })],
    ['tramo sin suma', conSeccion('despertar', { desglose: [{ origen: 'nivel', detalle: 'n' }] })],
    ['diferencia decimal', conSeccion('despertar', { diferencia: 1.5 })],
    ['personalidad no lista', { ...potencialDeApiDeReferencia(), personalidad: 'ENFJ' }],
    ['slot con letra_confirmada string', { ...potencialDeApiDeReferencia(), personalidad: [{ letra: 'E', nombre: 'E', letra_confirmada: 'si', confianza: 'medido', bonos: [] }] }],
    ['bono con stat desconocido', { ...potencialDeApiDeReferencia(), personalidad: [{ letra: 'E', nombre: 'E', letra_confirmada: true, confianza: 'medido', bonos: [{ stat: 'velocidad', descripcion: 'x', porcentaje: 1 }] }] }],
    ['bono con porcentaje string', { ...potencialDeApiDeReferencia(), personalidad: [{ letra: 'E', nombre: 'E', letra_confirmada: true, confianza: 'medido', bonos: [{ stat: null, descripcion: 'x', porcentaje: '1' }] }] }],
    ['objeto con nota desconocida', { ...potencialDeApiDeReferencia(), objeto: { aplicado: false, nota: 'rota' } }],
    ['objeto con aplicado string', { ...potencialDeApiDeReferencia(), objeto: { aplicado: 'no', nota: null } }],
    ['version_desconocida string', { ...potencialDeApiDeReferencia(), version_desconocida: 'si' }],
    ['aviso con confianza desconocida', { ...potencialDeApiDeReferencia(), avisos: [{ fecha: '2026-09-23', descripcion: 'x', confianza: 'y' }] }],
    ['aviso con fecha invalida', { ...potencialDeApiDeReferencia(), avisos: [{ fecha: '23/09', descripcion: 'x', confianza: 'fan' }] }],
    ['fecha_parche invalida', { ...potencialDeApiDeReferencia(), fecha_parche: '2026-02-30' }],
    ['sin_datos con numero', { ...potencialDeApiDeReferencia(), sin_datos: [1] }],
    ['no es objeto', 'hola']
  ])('rechaza %s', (_caso, api) => {
    expect(() => potencialDeApi(api)).toThrow(RespuestaInvalida)
  })
})
