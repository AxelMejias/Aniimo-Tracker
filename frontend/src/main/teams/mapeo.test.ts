import { describe, expect, it } from 'vitest'
import {
  entradaDeApiDeReferencia,
  fichaDeApiDeReferencia,
  fichaDeReferencia,
  fichaGuardadaDeReferencia
} from '../../../tests/fixtures/ficha'
import {
  camposDeValidacion,
  fichaAApi,
  fichaDeApi,
  listaDeTeamsDeApi,
  RespuestaInvalida,
  teamDeApi
} from './mapeo'

const ENTRADA_DE_API = entradaDeApiDeReferencia()

describe('fichaAApi', () => {
  it('traduce la ficha de referencia completa a la forma del backend', () => {
    expect(fichaAApi(fichaDeReferencia())).toEqual(ENTRADA_DE_API)
  })

  it('conserva los nulos y las listas vacias', () => {
    const base = fichaDeReferencia()
    const api = fichaAApi({
      ...base,
      elemento: null,
      objetos: [],
      notas: null,
      entrenamiento: { ...base.entrenamiento, nivelRequeridoSiguienteEtapa: null, materiales: [] }
    })
    expect(api.elemento).toBeNull()
    expect(api.objetos).toEqual([])
    expect(api.notas).toBeNull()
    expect(api.entrenamiento).toMatchObject({
      nivel_requerido_siguiente_etapa: null,
      materiales: []
    })
  })
})

describe('fichaDeApi', () => {
  it('ida y vuelta de la ficha de referencia sin perdida', () => {
    expect(fichaDeApi({ ...fichaAApi(fichaDeReferencia()), slot: 1, tiene_imagen: false })).toEqual(
      fichaGuardadaDeReferencia()
    )
  })

  it('traduce slot y tiene_imagen', () => {
    const ficha = fichaDeApi({ ...fichaDeApiDeReferencia(), slot: 3, tiene_imagen: true })
    expect(ficha.slot).toBe(3)
    expect(ficha.tieneImagen).toBe(true)
  })

  it.each([
    ['null', null],
    ['nivel string', { ...fichaDeApiDeReferencia(), nivel: '60' }],
    ['sin stats', { ...fichaDeApiDeReferencia(), stats: undefined }],
    ['elemento desconocido', { ...fichaDeApiDeReferencia(), elemento: 'metal' }],
    ['slot ausente', { ...ENTRADA_DE_API }]
  ])('rechaza una respuesta malformada: %s', (_caso, valor) => {
    expect(() => fichaDeApi(valor)).toThrow(RespuestaInvalida)
  })
})

describe('teamDeApi', () => {
  const resumen = {
    nombre: 'Irisalis',
    nivel: 60,
    cp: 3475,
    personalidad: 'ENFJ',
    estrella_actual: 2,
    despertares_usados: 28,
    despertares_total: 43,
    tiene_imagen: true
  }
  const team = {
    id: '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d',
    nombre: 'Principal',
    orden: 1,
    slots: [
      { slot: 1, aniimo: resumen },
      { slot: 2, aniimo: null },
      { slot: 3, aniimo: null },
      { slot: 4, aniimo: null }
    ]
  }

  it('traduce el resumen a camelCase y deja los slots vacios en null', () => {
    const traducido = teamDeApi(team)
    expect(traducido.slots[0]).toEqual({
      slot: 1,
      aniimo: {
        nombre: 'Irisalis',
        nivel: 60,
        cp: 3475,
        personalidad: 'ENFJ',
        estrellaActual: 2,
        despertaresUsados: 28,
        despertaresTotal: 43,
        tieneImagen: true
      }
    })
    expect(traducido.slots.map((s) => s.aniimo === null)).toEqual([false, true, true, true])
    expect(traducido).toMatchObject({ id: team.id, nombre: 'Principal', orden: 1 })
  })

  it('acepta personalidad nula', () => {
    const conNulo = { ...team, slots: [{ slot: 1, aniimo: { ...resumen, personalidad: null } }] }
    expect(teamDeApi(conNulo).slots[0]?.aniimo?.personalidad).toBeNull()
  })

  it('rechaza equipos con forma inesperada', () => {
    expect(() => teamDeApi({ ...team, slots: 'x' })).toThrow(RespuestaInvalida)
    expect(() => teamDeApi({ ...team, orden: '1' })).toThrow(RespuestaInvalida)
    expect(() => teamDeApi(null)).toThrow(RespuestaInvalida)
  })

  it('listaDeTeamsDeApi traduce cada team', () => {
    expect(listaDeTeamsDeApi({ teams: [team, { ...team, orden: 2 }] }).map((t) => t.orden)).toEqual([
      1, 2
    ])
    expect(listaDeTeamsDeApi({ teams: [] })).toEqual([])
    expect(() => listaDeTeamsDeApi({ teams: null })).toThrow(RespuestaInvalida)
  })
})

describe('camposDeValidacion', () => {
  it('traduce las rutas del 422 a rutas de campo sin el prefijo body', () => {
    const detalle = [
      { loc: ['body', 'stats', 'atq', 'potencial'], msg: 'mensaje interno', type: 't' },
      { loc: ['body', 'entrenamiento', 'despertares_usados'], msg: 'otro', type: 't' },
      { loc: ['body', 'objetos', 0, 'nivel'], msg: 'x', type: 't' },
      { loc: ['body', 'nombre'], msg: 'x', type: 't' }
    ]
    expect(camposDeValidacion({ detail: detalle })).toEqual([
      'stats.atq.potencial',
      'entrenamiento.despertares_usados',
      'objetos.0.nivel',
      'nombre'
    ])
  })

  it('elimina repetidos y descarta rutas que no son del cuerpo', () => {
    const detalle = [
      { loc: ['body', 'nombre'] },
      { loc: ['body', 'nombre'] },
      { loc: ['path', 'team_id'] },
      { loc: ['body'] },
      { loc: 'x' },
      'suelto'
    ]
    expect(camposDeValidacion({ detail: detalle })).toEqual(['nombre'])
  })

  it('devuelve vacio si el detalle no es una lista', () => {
    expect(camposDeValidacion({ detail: 'texto' })).toEqual([])
    expect(camposDeValidacion(undefined)).toEqual([])
  })
})
