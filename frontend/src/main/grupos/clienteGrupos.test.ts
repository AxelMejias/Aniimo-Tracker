import { describe, expect, it, vi } from 'vitest'
import { crearSesionEnMemoria } from '../auth/sesionEnMemoria'
import { URL_BASE_BACKEND, type FetchFn } from '../backend/peticion'
import { crearClienteGrupos } from './clienteGrupos'

type Respuesta = Response | Error

const TEAM_ID = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'
const OTRO_TEAM_ID = '6a4c2e8f-1b3d-4f50-8e7a-2d9c1b0a3f44'
const GRUPO_ID = '8b0e5d6a-3c21-4f7e-a1d4-9e2c7b6f0a13'
const OTRO_GRUPO_ID = '5d7a9c10-2b3e-4c85-8f16-0a4d3e2b1c99'
const MAXIMO_DE_GRUPOS = 'Ya tenés el máximo de 4 grupos'
const GRUPO_LLENO = 'Ese grupo ya tiene el máximo de 5 teams'
const ORDEN_DESACTUALIZADO = 'El orden cambió; recargá e intentá de nuevo'

function json(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  })
}

function preparar(...respuestas: Respuesta[]) {
  const cola = [...respuestas]
  const fetchFalso = vi.fn<FetchFn>(async () => {
    const siguiente = cola.shift()
    if (siguiente === undefined) {
      throw new Error('fetch inesperado')
    }
    if (siguiente instanceof Error) {
      throw siguiente
    }
    return siguiente
  })
  const sesion = crearSesionEnMemoria()
  sesion.guardar('tok-123', 'axel')
  return { cliente: crearClienteGrupos(fetchFalso, sesion), fetchFalso, sesion }
}

function llamada(fetchFalso: ReturnType<typeof preparar>['fetchFalso'], n = 0) {
  const [url, init] = fetchFalso.mock.calls[n] ?? []
  return {
    url: String(url),
    metodo: init?.method,
    cabeceras: new Headers(init?.headers),
    cuerpo: init?.body
  }
}

const teamApi = {
  id: TEAM_ID,
  nombre: 'Principal',
  orden: 1,
  oculto_para_amigos: false,
  grupo_id: GRUPO_ID,
  portada_slot: null,
  portada_efectiva_slot: null,
  slots: [1, 2, 3, 4].map((slot) => ({ slot, aniimo: null }))
}

const grupoApi = {
  id: GRUPO_ID,
  nombre: 'Buildeado',
  orden: 1,
  team_ids: [TEAM_ID],
  portada_team_id: null,
  portada_efectiva_team_id: TEAM_ID
}

const listaApi = { teams: [teamApi], grupos: [grupoApi] }

type Cliente = ReturnType<typeof preparar>['cliente']

const CON_LISTA: [string, string, string, (c: Cliente) => Promise<unknown>, unknown][] = [
  ['crear', 'POST', '/grupos', (c) => c.crear({ nombre: 'Buildeado' }), { nombre: 'Buildeado' }],
  [
    'renombrar',
    'PATCH',
    `/grupos/${GRUPO_ID}`,
    (c) => c.renombrar({ grupoId: GRUPO_ID, nombre: 'Homeland' }),
    { nombre: 'Homeland' }
  ],
  [
    'elegirPortada con un team',
    'PATCH',
    `/grupos/${GRUPO_ID}`,
    (c) => c.elegirPortada({ grupoId: GRUPO_ID, teamId: TEAM_ID }),
    { portada_team_id: TEAM_ID }
  ],
  [
    'elegirPortada automatica',
    'PATCH',
    `/grupos/${GRUPO_ID}`,
    (c) => c.elegirPortada({ grupoId: GRUPO_ID, teamId: null }),
    { portada_team_id: null }
  ],
  [
    'agregarTeam',
    'PUT',
    `/grupos/${GRUPO_ID}/teams/${TEAM_ID}`,
    (c) => c.agregarTeam({ grupoId: GRUPO_ID, teamId: TEAM_ID }),
    undefined
  ],
  [
    'ordenar',
    'PUT',
    '/grupos/orden',
    (c) => c.ordenar({ grupoIds: [OTRO_GRUPO_ID, GRUPO_ID] }),
    { grupo_ids: [OTRO_GRUPO_ID, GRUPO_ID] }
  ],
  [
    'ordenarTeams',
    'PUT',
    `/grupos/${GRUPO_ID}/orden`,
    (c) => c.ordenarTeams({ grupoId: GRUPO_ID, teamIds: [OTRO_TEAM_ID, TEAM_ID] }),
    { team_ids: [OTRO_TEAM_ID, TEAM_ID] }
  ],
  [
    'ordenarSueltos',
    'PUT',
    '/teams/sueltos/orden',
    (c) => c.ordenarSueltos({ teamIds: [OTRO_TEAM_ID, TEAM_ID] }),
    { team_ids: [OTRO_TEAM_ID, TEAM_ID] }
  ]
]

const SIN_CONTENIDO: [string, string, string, (c: Cliente) => Promise<unknown>][] = [
  ['borrar', 'DELETE', `/grupos/${GRUPO_ID}`, (c) => c.borrar({ grupoId: GRUPO_ID })],
  [
    'sacarTeam',
    'DELETE',
    `/grupos/${GRUPO_ID}/teams/${TEAM_ID}`,
    (c) => c.sacarTeam({ grupoId: GRUPO_ID, teamId: TEAM_ID })
  ]
]

describe('rutas, metodos, cuerpos y autorizacion', () => {
  it.each(CON_LISTA)(
    '%s envia %s %s con el cuerpo esperado',
    async (_n, metodo, ruta, ejecutar, cuerpo) => {
      const { cliente, fetchFalso } = preparar(json(200, listaApi))
      const resultado = await ejecutar(cliente)
      expect(resultado).toMatchObject({ ok: true })
      const enviada = llamada(fetchFalso)
      expect(enviada.url).toBe(`${URL_BASE_BACKEND}${ruta}`)
      expect(enviada.metodo).toBe(metodo)
      expect(enviada.cabeceras.get('Authorization')).toBe('Bearer tok-123')
      if (cuerpo === undefined) {
        expect(enviada.cuerpo ?? undefined).toBeUndefined()
      } else {
        expect(JSON.parse(String(enviada.cuerpo))).toEqual(cuerpo)
      }
      expect(JSON.stringify(resultado)).not.toContain('tok-123')
    }
  )

  it.each(SIN_CONTENIDO)(
    '%s envia %s %s y devuelve ok sin datos',
    async (_n, metodo, ruta, ejecutar) => {
      const { cliente, fetchFalso } = preparar(json(204))
      expect(await ejecutar(cliente)).toEqual({ ok: true })
      const enviada = llamada(fetchFalso)
      expect(enviada.url).toBe(`${URL_BASE_BACKEND}${ruta}`)
      expect(enviada.metodo).toBe(metodo)
      expect(enviada.cabeceras.get('Authorization')).toBe('Bearer tok-123')
    }
  )
})

describe('resultados traducidos', () => {
  it('devuelve teams y grupos en camelCase', async () => {
    const { cliente } = preparar(json(201, listaApi))
    const resultado = await cliente.crear({ nombre: 'Buildeado' })
    expect(resultado).toMatchObject({
      ok: true,
      teams: [{ id: TEAM_ID, grupoId: GRUPO_ID }],
      grupos: [
        {
          id: GRUPO_ID,
          teamIds: [TEAM_ID],
          portadaTeamId: null,
          portadaEfectivaTeamId: TEAM_ID
        }
      ]
    })
  })

  it('una respuesta con forma inesperada es error-inesperado', async () => {
    const { cliente } = preparar(json(200, { teams: [] }))
    expect(await cliente.crear({ nombre: 'X' })).toEqual({ ok: false, error: 'error-inesperado' })
  })
})

describe('errores traducidos', () => {
  it.each([
    [MAXIMO_DE_GRUPOS, 'limite-de-grupos'],
    [GRUPO_LLENO, 'grupo-lleno'],
    [ORDEN_DESACTUALIZADO, 'conflicto'],
    ['Conflicto al guardar, intentá de nuevo', 'conflicto']
  ])('el 409 "%s" devuelve %s', async (detail, codigo) => {
    const { cliente } = preparar(json(409, { detail }))
    expect(await cliente.crear({ nombre: 'X' })).toEqual({ ok: false, error: codigo })
  })

  it('el 409 de orden desactualizado al ordenar devuelve conflicto', async () => {
    const { cliente } = preparar(json(409, { detail: ORDEN_DESACTUALIZADO }))
    expect(await cliente.ordenar({ grupoIds: [GRUPO_ID] })).toEqual({
      ok: false,
      error: 'conflicto'
    })
  })

  it('401 borra la sesion y devuelve sesion-vencida', async () => {
    const { cliente, sesion } = preparar(json(401, { detail: 'No autenticado' }))
    expect(await cliente.borrar({ grupoId: GRUPO_ID })).toEqual({
      ok: false,
      error: 'sesion-vencida'
    })
    expect(sesion.obtener()).toBeNull()
  })

  it('404 devuelve no-encontrado', async () => {
    const { cliente } = preparar(json(404, { detail: 'No encontrado' }))
    expect(await cliente.sacarTeam({ grupoId: GRUPO_ID, teamId: TEAM_ID })).toEqual({
      ok: false,
      error: 'no-encontrado'
    })
  })

  it('422 devuelve datos-invalidos sin texto del backend', async () => {
    const detalle = [{ loc: ['body', 'nombre'], msg: 'mensaje interno', type: 't' }]
    const { cliente } = preparar(json(422, { detail: detalle }))
    const resultado = await cliente.crear({ nombre: 'X' })
    expect(resultado).toEqual({ ok: false, error: 'datos-invalidos', campos: ['nombre'] })
    expect(JSON.stringify(resultado)).not.toContain('mensaje')
  })

  it('un fallo de red devuelve sin-conexion', async () => {
    const { cliente } = preparar(new TypeError('fetch failed'))
    expect(await cliente.agregarTeam({ grupoId: GRUPO_ID, teamId: TEAM_ID })).toEqual({
      ok: false,
      error: 'sin-conexion'
    })
  })

  it('un 500 devuelve error-inesperado sin el cuerpo del backend', async () => {
    const { cliente } = preparar(json(500, { detail: 'traza secreta' }))
    const resultado = await cliente.ordenarSueltos({ teamIds: [TEAM_ID] })
    expect(resultado).toEqual({ ok: false, error: 'error-inesperado' })
    expect(JSON.stringify(resultado)).not.toContain('secreta')
  })
})
