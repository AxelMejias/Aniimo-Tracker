import { describe, expect, it, vi } from 'vitest'
import {
  entradaDeApiDeReferencia,
  fichaDeApiDeReferencia,
  fichaDeReferencia
} from '../../../tests/fixtures/ficha'
import { crearSesionEnMemoria } from '../auth/sesionEnMemoria'
import { URL_BASE_BACKEND, type FetchFn } from '../backend/peticion'
import { crearClienteTeams } from './clienteTeams'

type Respuesta = Response | Error

const TEAM_ID = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'
const MENSAJE_MAXIMO = 'Ya tenés el máximo de 4 teams'

function json(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  })
}

function binario(estado: number, bytes: Uint8Array, tipo: string): Response {
  return new Response(new Uint8Array(bytes), { status: estado, headers: { 'Content-Type': tipo } })
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
  return { cliente: crearClienteTeams(fetchFalso, sesion), fetchFalso, sesion }
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

const resumenApi = {
  id: TEAM_ID,
  nombre: 'Principal',
  orden: 1,
  slots: [1, 2, 3, 4].map((slot) => ({ slot, aniimo: null }))
}

describe('rutas, metodos y autorizacion', () => {
  const casos: [string, string, string, (c: ReturnType<typeof preparar>['cliente']) => Promise<unknown>, Response][] = [
    ['listar', 'GET', '/teams', (c) => c.listar(), json(200, { teams: [] })],
    ['crear', 'POST', '/teams', (c) => c.crear({ nombre: 'Raid' }), json(201, resumenApi)],
    [
      'renombrar',
      'PATCH',
      `/teams/${TEAM_ID}`,
      (c) => c.renombrar({ teamId: TEAM_ID, nombre: 'Raid' }),
      json(200, resumenApi)
    ],
    ['borrar', 'DELETE', `/teams/${TEAM_ID}`, (c) => c.borrar({ teamId: TEAM_ID }), json(204)],
    [
      'obtenerFicha',
      'GET',
      `/teams/${TEAM_ID}/aniimo/2`,
      (c) => c.obtenerFicha({ teamId: TEAM_ID, slot: 2 }),
      json(200, { aniimo: null })
    ],
    [
      'guardarFicha',
      'PUT',
      `/teams/${TEAM_ID}/aniimo/2`,
      (c) => c.guardarFicha({ teamId: TEAM_ID, slot: 2, ficha: fichaDeReferencia() }),
      json(200, { aniimo: fichaDeApiDeReferencia() })
    ],
    [
      'vaciarSlot',
      'DELETE',
      `/teams/${TEAM_ID}/aniimo/2`,
      (c) => c.vaciarSlot({ teamId: TEAM_ID, slot: 2 }),
      json(204)
    ],
    [
      'obtenerImagen',
      'GET',
      `/teams/${TEAM_ID}/aniimo/3/imagen`,
      (c) => c.obtenerImagen({ teamId: TEAM_ID, slot: 3 }),
      binario(200, new Uint8Array([1, 2]), 'image/webp')
    ],
    [
      'guardarImagen',
      'PUT',
      `/teams/${TEAM_ID}/aniimo/3/imagen`,
      (c) =>
        c.guardarImagen({
          teamId: TEAM_ID,
          slot: 3,
          tipo: 'image/webp',
          datos: new Uint8Array([1, 2])
        }),
      json(204)
    ],
    [
      'borrarImagen',
      'DELETE',
      `/teams/${TEAM_ID}/aniimo/3/imagen`,
      (c) => c.borrarImagen({ teamId: TEAM_ID, slot: 3 }),
      json(204)
    ]
  ]

  it.each(casos)('%s usa %s %s con Authorization Bearer', async (_n, metodo, ruta, ejecutar, ok) => {
    const { cliente, fetchFalso } = preparar(ok)
    const resultado = await ejecutar(cliente)
    expect(resultado).toMatchObject({ ok: true })
    const enviada = llamada(fetchFalso)
    expect(enviada.url).toBe(`${URL_BASE_BACKEND}${ruta}`)
    expect(enviada.metodo).toBe(metodo)
    expect(enviada.cabeceras.get('Authorization')).toBe('Bearer tok-123')
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })
})

describe('cuerpos', () => {
  it('crear envia el nombre como JSON', async () => {
    const { cliente, fetchFalso } = preparar(json(201, resumenApi))
    await cliente.crear({ nombre: 'Raid' })
    const enviada = llamada(fetchFalso)
    expect(enviada.cabeceras.get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(enviada.cuerpo))).toEqual({ nombre: 'Raid' })
  })

  it('guardarFicha envia la ficha en la forma del backend', async () => {
    const { cliente, fetchFalso } = preparar(json(200, { aniimo: fichaDeApiDeReferencia() }))
    await cliente.guardarFicha({ teamId: TEAM_ID, slot: 1, ficha: fichaDeReferencia() })
    expect(JSON.parse(String(llamada(fetchFalso).cuerpo))).toEqual(entradaDeApiDeReferencia())
  })

  it('guardarImagen envia los bytes crudos con su Content-Type', async () => {
    const { cliente, fetchFalso } = preparar(json(204))
    const datos = new Uint8Array([9, 8, 7, 6])
    await cliente.guardarImagen({ teamId: TEAM_ID, slot: 1, tipo: 'image/png', datos })
    const enviada = llamada(fetchFalso)
    expect(enviada.cabeceras.get('Content-Type')).toBe('image/png')
    expect(new Uint8Array(enviada.cuerpo as Uint8Array)).toEqual(datos)
  })
})

describe('resultados traducidos', () => {
  it('listar entrega los equipos en camelCase', async () => {
    const aniimo = {
      nombre: 'Irisalis',
      nivel: 60,
      cp: 3475,
      personalidad: 'ENFJ',
      estrella_actual: 2,
      despertares_usados: 28,
      despertares_total: 43,
      tiene_imagen: false
    }
    const team = { ...resumenApi, slots: [{ slot: 1, aniimo }, ...resumenApi.slots.slice(1)] }
    const { cliente } = preparar(json(200, { teams: [team] }))
    const resultado = await cliente.listar()
    expect(resultado).toMatchObject({ ok: true })
    if (resultado.ok) {
      expect(resultado.teams[0]?.slots[0]?.aniimo).toMatchObject({
        estrellaActual: 2,
        despertaresUsados: 28
      })
    }
  })

  it('guardarFicha devuelve la ficha traducida', async () => {
    const { cliente } = preparar(json(200, { aniimo: fichaDeApiDeReferencia() }))
    const resultado = await cliente.guardarFicha({
      teamId: TEAM_ID,
      slot: 1,
      ficha: fichaDeReferencia()
    })
    expect(resultado).toEqual({
      ok: true,
      ficha: { ...fichaDeReferencia(), slot: 1, tieneImagen: false }
    })
  })

  it('obtenerFicha de un slot vacio devuelve ficha null', async () => {
    const { cliente } = preparar(json(200, { aniimo: null }))
    expect(await cliente.obtenerFicha({ teamId: TEAM_ID, slot: 1 })).toEqual({
      ok: true,
      ficha: null
    })
  })

  it('obtenerImagen entrega una data URL con el tipo guardado', async () => {
    const { cliente } = preparar(binario(200, new Uint8Array([1, 2, 3]), 'image/webp'))
    expect(await cliente.obtenerImagen({ teamId: TEAM_ID, slot: 1 })).toEqual({
      ok: true,
      imagen: 'data:image/webp;base64,AQID'
    })
  })

  it('obtenerImagen sin imagen (404) devuelve imagen null', async () => {
    const { cliente } = preparar(json(404, { detail: 'No encontrado' }))
    expect(await cliente.obtenerImagen({ teamId: TEAM_ID, slot: 1 })).toEqual({
      ok: true,
      imagen: null
    })
  })

  it('obtenerImagen con un tipo que no es de imagen permitido es error-inesperado', async () => {
    const { cliente } = preparar(binario(200, new Uint8Array([1]), 'image/svg+xml'))
    expect(await cliente.obtenerImagen({ teamId: TEAM_ID, slot: 1 })).toEqual({
      ok: false,
      error: 'error-inesperado'
    })
  })

  it('una respuesta con forma inesperada es error-inesperado', async () => {
    const { cliente } = preparar(json(200, { teams: 'x' }))
    expect(await cliente.listar()).toEqual({ ok: false, error: 'error-inesperado' })
  })

  it('una respuesta que no es JSON es error-inesperado', async () => {
    const { cliente } = preparar(new Response('<html>', { status: 200 }))
    expect(await cliente.listar()).toEqual({ ok: false, error: 'error-inesperado' })
  })
})

describe('errores traducidos', () => {
  const ficha = { teamId: TEAM_ID, slot: 1, ficha: fichaDeReferencia() }

  it('401 borra la sesion y devuelve sesion-vencida', async () => {
    const { cliente, sesion } = preparar(json(401, { detail: 'No autenticado' }))
    expect(await cliente.guardarFicha(ficha)).toEqual({ ok: false, error: 'sesion-vencida' })
    expect(sesion.obtener()).toBeNull()
  })

  it('404 devuelve no-encontrado', async () => {
    const { cliente } = preparar(json(404, { detail: 'No encontrado' }))
    expect(await cliente.obtenerFicha({ teamId: TEAM_ID, slot: 1 })).toEqual({
      ok: false,
      error: 'no-encontrado'
    })
  })

  it('el 409 de maximo de teams devuelve limite-de-teams', async () => {
    const { cliente } = preparar(json(409, { detail: MENSAJE_MAXIMO }))
    expect(await cliente.crear({ nombre: 'Otro' })).toEqual({
      ok: false,
      error: 'limite-de-teams'
    })
  })

  it('cualquier otro 409 devuelve conflicto', async () => {
    const { cliente } = preparar(json(409, { detail: 'Conflicto al guardar, intentá de nuevo' }))
    expect(await cliente.crear({ nombre: 'Otro' })).toEqual({ ok: false, error: 'conflicto' })
  })

  it('422 devuelve datos-invalidos con las rutas de campo y sin texto del backend', async () => {
    const detalle = [
      { loc: ['body', 'stats', 'atq', 'potencial'], msg: 'mensaje interno', type: 't' }
    ]
    const { cliente } = preparar(json(422, { detail: detalle }))
    const resultado = await cliente.guardarFicha(ficha)
    expect(resultado).toEqual({
      ok: false,
      error: 'datos-invalidos',
      campos: ['stats.atq.potencial']
    })
    expect(JSON.stringify(resultado)).not.toContain('mensaje')
  })

  it.each([413, 415, 422])('%i al guardar imagen devuelve imagen-invalida', async (estado) => {
    const { cliente } = preparar(json(estado, { detail: 'x' }))
    expect(
      await cliente.guardarImagen({
        teamId: TEAM_ID,
        slot: 1,
        tipo: 'image/png',
        datos: new Uint8Array([1])
      })
    ).toEqual({ ok: false, error: 'imagen-invalida' })
  })

  it('un fallo de red devuelve sin-conexion', async () => {
    const { cliente } = preparar(new TypeError('fetch failed'))
    expect(await cliente.listar()).toEqual({ ok: false, error: 'sin-conexion' })
  })

  it('un 500 devuelve error-inesperado sin el cuerpo del backend', async () => {
    const { cliente } = preparar(json(500, { detail: 'traza secreta' }))
    const resultado = await cliente.listar()
    expect(resultado).toEqual({ ok: false, error: 'error-inesperado' })
    expect(JSON.stringify(resultado)).not.toContain('secreta')
  })

  it('sin sesion en memoria la request no lleva Authorization', async () => {
    const { cliente, fetchFalso, sesion } = preparar(json(401, { detail: 'No autenticado' }))
    sesion.borrar()
    await cliente.listar()
    expect(llamada(fetchFalso).cabeceras.get('Authorization')).toBeNull()
  })
})
