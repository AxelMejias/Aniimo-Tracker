import { describe, expect, it } from 'vitest'
import {
  entradaDeApiDeReferencia,
  fichaDeApiDeReferencia,
  fichaDeReferencia,
  fichaGuardadaDeReferencia,
  omitir
} from '../../../tests/fixtures/ficha'
import {
  camposDeValidacion,
  fichaAApi,
  fichaDeApi,
  grupoDeAmigoDeApi,
  listaDeTeamsDeApi,
  RespuestaInvalida,
  teamDeAmigoDeApi,
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

describe('notas privadas y visibilidad', () => {
  it('fichaAApi envia notas_privadas', () => {
    expect(fichaAApi({ ...fichaDeReferencia(), notasPrivadas: true }).notas_privadas).toBe(true)
    expect(fichaAApi(fichaDeReferencia()).notas_privadas).toBe(false)
  })

  it('fichaDeApi traduce notas_privadas', () => {
    const api = { ...fichaDeApiDeReferencia(), notas_privadas: true }
    expect(fichaDeApi(api).notasPrivadas).toBe(true)
  })

  it('fichaDeApi rechaza una ficha sin notas_privadas', () => {
    const sin = omitir(fichaDeApiDeReferencia(), 'notas_privadas')
    expect(() => fichaDeApi(sin)).toThrow(RespuestaInvalida)
  })

  it('teamDeApi traduce oculto_para_amigos y lo exige', () => {
    const base = {
      id: 'x',
      nombre: 'Raid',
      orden: 1,
      grupo_id: null,
      portada_slot: null,
      portada_efectiva_slot: null,
      slots: []
    }
    expect(teamDeApi({ ...base, oculto_para_amigos: true }).ocultoParaAmigos).toBe(true)
    expect(teamDeApi({ ...base, oculto_para_amigos: false }).ocultoParaAmigos).toBe(false)
    expect(() => teamDeApi(base)).toThrow(RespuestaInvalida)
    expect(() => teamDeApi({ ...base, oculto_para_amigos: 'si' })).toThrow(RespuestaInvalida)
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

const GRUPO_ID = '8b0e5d6a-3c21-4f7e-a1d4-9e2c7b6f0a13'
const OTRO_GRUPO_ID = '5d7a9c10-2b3e-4c85-8f16-0a4d3e2b1c99'

describe('teamDeApi', () => {
  const resumen = {
    nombre: 'Irisalis',
    elemento: 'hielo',
    rol: 'curacion',
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
    oculto_para_amigos: false,
    grupo_id: null,
    portada_slot: null,
    portada_efectiva_slot: 1,
    slots: [
      { slot: 1, aniimo: resumen },
      { slot: 2, aniimo: null },
      { slot: 3, aniimo: null },
      { slot: 4, aniimo: null }
    ]
  }

  const grupoApi = {
    id: GRUPO_ID,
    nombre: 'Buildeado',
    orden: 1,
    team_ids: [team.id],
    portada_team_id: team.id,
    portada_efectiva_team_id: team.id
  }

  it('traduce el resumen a camelCase y deja los slots vacios en null', () => {
    const traducido = teamDeApi(team)
    expect(traducido.slots[0]).toEqual({
      slot: 1,
      aniimo: {
        nombre: 'Irisalis',
        elemento: 'hielo',
        rol: 'curacion',
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

  it('traduce elemento y rol nulos a null', () => {
    const sinDatos = {
      ...team,
      slots: [{ slot: 1, aniimo: { ...resumen, elemento: null, rol: null } }]
    }
    const aniimo = teamDeApi(sinDatos).slots[0]?.aniimo
    expect(aniimo?.elemento).toBeNull()
    expect(aniimo?.rol).toBeNull()
  })

  it.each([
    ['elemento fuera de catalogo', { elemento: 'lava' }],
    ['rol fuera de catalogo', { rol: 'tanque' }],
    ['elemento numerico', { elemento: 3 }],
    ['sin elemento', { elemento: undefined }],
    ['sin rol', { rol: undefined }]
  ])('rechaza un resumen con %s', (_nombre, cambios) => {
    const invalido = { ...team, slots: [{ slot: 1, aniimo: { ...resumen, ...cambios } }] }
    expect(() => teamDeApi(invalido)).toThrow(RespuestaInvalida)
  })

  it('rechaza equipos con forma inesperada', () => {
    expect(() => teamDeApi({ ...team, slots: 'x' })).toThrow(RespuestaInvalida)
    expect(() => teamDeApi({ ...team, orden: '1' })).toThrow(RespuestaInvalida)
    expect(() => teamDeApi(null)).toThrow(RespuestaInvalida)
  })

  it('traduce el grupo, la portada elegida y la portada efectiva del team', () => {
    const traducido = teamDeApi({
      ...team,
      grupo_id: GRUPO_ID,
      portada_slot: 3,
      portada_efectiva_slot: 3
    })
    expect(traducido).toMatchObject({ grupoId: GRUPO_ID, portadaSlot: 3, portadaEfectivaSlot: 3 })
    expect(teamDeApi(team)).toMatchObject({
      grupoId: null,
      portadaSlot: null,
      portadaEfectivaSlot: 1
    })
  })

  it.each([
    ['sin grupo_id', omitir(team, 'grupo_id')],
    ['grupo_id numerico', { ...team, grupo_id: 5 }],
    ['sin portada_slot', omitir(team, 'portada_slot')],
    ['portada_slot texto', { ...team, portada_slot: '3' }],
    ['sin portada_efectiva_slot', omitir(team, 'portada_efectiva_slot')]
  ])('rechaza un team %s', (_caso, invalido) => {
    expect(() => teamDeApi(invalido)).toThrow(RespuestaInvalida)
  })

  it('listaDeTeamsDeApi traduce cada team y cada grupo', () => {
    const lista = listaDeTeamsDeApi({
      teams: [team, { ...team, orden: 2 }],
      grupos: [grupoApi, { ...grupoApi, id: OTRO_GRUPO_ID, orden: 2, portada_team_id: null }]
    })
    expect(lista.teams.map((t) => t.orden)).toEqual([1, 2])
    expect(lista.grupos).toEqual([
      {
        id: GRUPO_ID,
        nombre: 'Buildeado',
        orden: 1,
        teamIds: [team.id],
        portadaTeamId: team.id,
        portadaEfectivaTeamId: team.id
      },
      {
        id: OTRO_GRUPO_ID,
        nombre: 'Buildeado',
        orden: 2,
        teamIds: [team.id],
        portadaTeamId: null,
        portadaEfectivaTeamId: team.id
      }
    ])
    expect(listaDeTeamsDeApi({ teams: [], grupos: [] })).toEqual({ teams: [], grupos: [] })
  })

  it.each([
    ['teams nulo', { teams: null, grupos: [] }],
    ['sin grupos', { teams: [] }],
    ['grupos nulo', { teams: [], grupos: null }],
    ['team_ids con un numero', { teams: [], grupos: [{ ...grupoApi, team_ids: [1] }] }],
    ['grupo sin nombre', { teams: [], grupos: [omitir(grupoApi, 'nombre')] }],
    ['portada efectiva numerica', { teams: [], grupos: [{ ...grupoApi, portada_efectiva_team_id: 3 }] }]
  ])('listaDeTeamsDeApi rechaza %s', (_caso, invalida) => {
    expect(() => listaDeTeamsDeApi(invalida)).toThrow(RespuestaInvalida)
  })

  it('traduce el team y el grupo de un amigo, donde portada_slot ya es la efectiva', () => {
    const delAmigo = omitir(omitir(team, 'oculto_para_amigos'), 'portada_efectiva_slot')
    expect(teamDeAmigoDeApi({ ...delAmigo, grupo_id: GRUPO_ID, portada_slot: 2 })).toMatchObject({
      grupoId: GRUPO_ID,
      portadaSlot: 2
    })
    expect(
      grupoDeAmigoDeApi({
        id: GRUPO_ID,
        nombre: 'Competitivo',
        orden: 1,
        team_ids: [team.id],
        portada_team_id: team.id
      })
    ).toEqual({
      id: GRUPO_ID,
      nombre: 'Competitivo',
      orden: 1,
      teamIds: [team.id],
      portadaTeamId: team.id
    })
    expect(() => teamDeAmigoDeApi(omitir(delAmigo, 'grupo_id'))).toThrow(RespuestaInvalida)
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

describe('fechaParche y etapaEstrella', () => {
  it('fichaAApi las envia como fecha_parche y etapa_estrella', () => {
    const api = fichaAApi({ ...fichaDeReferencia(), fechaParche: '2026-09-23', etapaEstrella: 3 })
    expect(api.fecha_parche).toBe('2026-09-23')
    expect(api.etapa_estrella).toBe(3)
  })

  it('fichaAApi conserva los nulos y no mezcla la etapa con estrellaActual', () => {
    const api = fichaAApi({ ...fichaDeReferencia(), fechaParche: null, etapaEstrella: null })
    expect(api.fecha_parche).toBeNull()
    expect(api.etapa_estrella).toBeNull()
    expect(api.entrenamiento).toMatchObject({ estrella_actual: 2 })
  })

  it('fichaDeApi traduce la fecha y la etapa', () => {
    const ficha = fichaDeApi(fichaDeApiDeReferencia())
    expect(ficha.fechaParche).toBe('2026-10-26')
    expect(ficha.etapaEstrella).toBe(6)
    expect(ficha.entrenamiento.estrellaActual).toBe(2)
  })

  it('fichaDeApi acepta fecha y etapa en null', () => {
    const ficha = fichaDeApi({ ...fichaDeApiDeReferencia(), fecha_parche: null, etapa_estrella: null })
    expect(ficha.fechaParche).toBeNull()
    expect(ficha.etapaEstrella).toBeNull()
  })

  it('fichaDeApi acepta la etapa 0 como un valor distinto de sin cargar', () => {
    expect(fichaDeApi({ ...fichaDeApiDeReferencia(), etapa_estrella: 0 }).etapaEstrella).toBe(0)
  })

  it.each([
    ['sin fecha_parche', omitir(fichaDeApiDeReferencia(), 'fecha_parche')],
    ['fecha con otro formato', { ...fichaDeApiDeReferencia(), fecha_parche: '26/10/2026' }],
    ['fecha inexistente', { ...fichaDeApiDeReferencia(), fecha_parche: '2026-02-30' }],
    ['fecha numerica', { ...fichaDeApiDeReferencia(), fecha_parche: 20261026 }],
    ['sin etapa_estrella', omitir(fichaDeApiDeReferencia(), 'etapa_estrella')],
    ['etapa 8', { ...fichaDeApiDeReferencia(), etapa_estrella: 8 }],
    ['etapa string', { ...fichaDeApiDeReferencia(), etapa_estrella: '6' }],
    ['etapa decimal', { ...fichaDeApiDeReferencia(), etapa_estrella: 6.5 }]
  ])('fichaDeApi rechaza %s', (_caso, api) => {
    expect(() => fichaDeApi(api)).toThrow(RespuestaInvalida)
  })
})
