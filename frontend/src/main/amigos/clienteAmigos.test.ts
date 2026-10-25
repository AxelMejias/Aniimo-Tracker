import { describe, expect, it, vi } from 'vitest'
import { fichaDeApiDeReferencia, omitir } from '../../../tests/fixtures/ficha'
import { crearSesionEnMemoria } from '../auth/sesionEnMemoria'
import { URL_BASE_BACKEND, type FetchFn } from '../backend/peticion'
import { crearClienteAmigos } from './clienteAmigos'

type Respuesta = Response | Error

const USUARIO_ID = '7a1d3c52-6b0e-4f3a-8d21-5c9e4b7a0f11'
const TEAM_ID = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'

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
  return { cliente: crearClienteAmigos(fetchFalso, sesion), fetchFalso, sesion }
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

const usuarioApi = { id: USUARIO_ID, nombre_usuario: 'bruno', relacion: 'ninguna' }
const teamApi = {
  id: TEAM_ID,
  nombre: 'Principal',
  orden: 1,
  slots: [1, 2, 3, 4].map((slot) => ({ slot, aniimo: null }))
}

function fichaDeAmigoApi(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  const resto = omitir(fichaDeApiDeReferencia(), 'notas_privadas')
  return { ...resto, slot: 1, tiene_imagen: false, ...cambios }
}

type Cliente = ReturnType<typeof preparar>['cliente']

describe('rutas, metodos y autorizacion', () => {
  const casos: [string, string, string, (c: Cliente) => Promise<unknown>, Response][] = [
    [
      'buscar',
      'GET',
      '/usuarios?nombre_usuario=bruno',
      (c) => c.buscar({ nombreUsuario: 'bruno' }),
      json(200, { usuario: usuarioApi })
    ],
    [
      'listar',
      'GET',
      '/amigos',
      (c) => c.listar(),
      json(200, { amigos: [], recibidas: [], enviadas: [] })
    ],
    [
      'enviarSolicitud',
      'POST',
      '/amigos/solicitudes',
      (c) => c.enviarSolicitud({ usuarioId: USUARIO_ID }),
      json(201, { ...usuarioApi, relacion: 'solicitud_enviada' })
    ],
    [
      'aceptarSolicitud',
      'POST',
      `/amigos/solicitudes/${USUARIO_ID}/aceptar`,
      (c) => c.aceptarSolicitud({ usuarioId: USUARIO_ID }),
      json(200, { ...usuarioApi, relacion: 'amigo' })
    ],
    [
      'eliminar',
      'DELETE',
      `/amigos/${USUARIO_ID}`,
      (c) => c.eliminar({ usuarioId: USUARIO_ID }),
      json(204)
    ],
    [
      'listarTeams',
      'GET',
      `/amigos/${USUARIO_ID}/teams`,
      (c) => c.listarTeams({ usuarioId: USUARIO_ID }),
      json(200, { usuario: { id: USUARIO_ID, nombre_usuario: 'bruno' }, teams: [teamApi] })
    ],
    [
      'obtenerFicha',
      'GET',
      `/amigos/${USUARIO_ID}/teams/${TEAM_ID}/aniimo/2`,
      (c) => c.obtenerFicha({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 2 }),
      json(200, { aniimo: fichaDeAmigoApi({ slot: 2 }) })
    ],
    [
      'obtenerImagen',
      'GET',
      `/amigos/${USUARIO_ID}/teams/${TEAM_ID}/aniimo/3/imagen`,
      (c) => c.obtenerImagen({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 3 }),
      binario(200, new Uint8Array([1, 2]), 'image/webp')
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

  it('enviarSolicitud manda el usuario_id como JSON', async () => {
    const { cliente, fetchFalso } = preparar(json(201, { ...usuarioApi, relacion: 'solicitud_enviada' }))
    await cliente.enviarSolicitud({ usuarioId: USUARIO_ID })
    expect(JSON.parse(String(llamada(fetchFalso).cuerpo))).toEqual({ usuario_id: USUARIO_ID })
  })
})

describe('resultados traducidos', () => {
  it.each([
    ['ninguna', 'ninguna'],
    ['solicitud_enviada', 'solicitud-enviada'],
    ['solicitud_recibida', 'solicitud-recibida'],
    ['amigo', 'amigo']
  ])('buscar traduce la relacion %s', async (api, esperado) => {
    const { cliente } = preparar(json(200, { usuario: { ...usuarioApi, relacion: api } }))
    expect(await cliente.buscar({ nombreUsuario: 'bruno' })).toEqual({
      ok: true,
      usuario: { id: USUARIO_ID, nombreUsuario: 'bruno', relacion: esperado }
    })
  })

  it('buscar sin resultado devuelve usuario null', async () => {
    const { cliente } = preparar(json(200, { usuario: null }))
    expect(await cliente.buscar({ nombreUsuario: 'nadie' })).toEqual({ ok: true, usuario: null })
  })

  it('una relacion desconocida es una respuesta inesperada', async () => {
    const { cliente } = preparar(json(200, { usuario: { ...usuarioApi, relacion: 'otra' } }))
    expect(await cliente.buscar({ nombreUsuario: 'bruno' })).toEqual({
      ok: false,
      error: 'error-inesperado'
    })
  })

  it('listar traduce las tres listas', async () => {
    const { cliente } = preparar(
      json(200, {
        amigos: [{ id: USUARIO_ID, nombre_usuario: 'bruno', desde: '2026-10-25T10:00:00Z' }],
        recibidas: [{ id: 'b', nombre_usuario: 'carla', creada_en: '2026-10-25T11:00:00Z' }],
        enviadas: [{ id: 'c', nombre_usuario: 'dario', creada_en: '2026-10-25T12:00:00Z' }]
      })
    )
    expect(await cliente.listar()).toEqual({
      ok: true,
      amigos: [{ id: USUARIO_ID, nombreUsuario: 'bruno', desde: '2026-10-25T10:00:00Z' }],
      recibidas: [{ id: 'b', nombreUsuario: 'carla', creadaEn: '2026-10-25T11:00:00Z' }],
      enviadas: [{ id: 'c', nombreUsuario: 'dario', creadaEn: '2026-10-25T12:00:00Z' }]
    })
  })

  it('enviar y aceptar devuelven el usuario con su relacion', async () => {
    const { cliente } = preparar(
      json(201, { ...usuarioApi, relacion: 'solicitud_enviada' }),
      json(200, { ...usuarioApi, relacion: 'amigo' })
    )
    expect(await cliente.enviarSolicitud({ usuarioId: USUARIO_ID })).toEqual({
      ok: true,
      usuario: { id: USUARIO_ID, nombreUsuario: 'bruno', relacion: 'solicitud-enviada' }
    })
    expect(await cliente.aceptarSolicitud({ usuarioId: USUARIO_ID })).toMatchObject({
      usuario: { relacion: 'amigo' }
    })
  })

  it('listarTeams devuelve el duenio y los teams sin el flag de visibilidad', async () => {
    const { cliente } = preparar(
      json(200, { usuario: { id: USUARIO_ID, nombre_usuario: 'bruno' }, teams: [teamApi] })
    )
    const resultado = await cliente.listarTeams({ usuarioId: USUARIO_ID })
    expect(resultado).toEqual({
      ok: true,
      usuario: { id: USUARIO_ID, nombreUsuario: 'bruno' },
      teams: [{ id: TEAM_ID, nombre: 'Principal', orden: 1, slots: teamApi.slots }]
    })
    expect(JSON.stringify(resultado)).not.toContain('ocultoParaAmigos')
  })

  it('obtenerFicha usa el mapeo de la ficha y no agrega notasPrivadas', async () => {
    const { cliente } = preparar(json(200, { aniimo: fichaDeAmigoApi() }))
    const resultado = await cliente.obtenerFicha({
      usuarioId: USUARIO_ID,
      teamId: TEAM_ID,
      slot: 1
    })
    expect(resultado).toMatchObject({
      ok: true,
      ficha: { nombre: 'Irisalis', slot: 1, tieneImagen: false, notas: 'Aniimo de referencia' }
    })
    expect(JSON.stringify(resultado)).not.toContain('notasPrivadas')
  })

  it('las notas en null llegan como null', async () => {
    const api = fichaDeAmigoApi({ notas: null, notas_habilidades: null })
    const { cliente } = preparar(json(200, { aniimo: api }))
    const resultado = await cliente.obtenerFicha({
      usuarioId: USUARIO_ID,
      teamId: TEAM_ID,
      slot: 1
    })
    expect(resultado).toMatchObject({ ok: true, ficha: { notas: null, notasHabilidades: null } })
  })

  it('obtenerFicha de un slot vacio devuelve ficha null', async () => {
    const { cliente } = preparar(json(200, { aniimo: null }))
    expect(
      await cliente.obtenerFicha({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1 })
    ).toEqual({ ok: true, ficha: null })
  })

  it('obtenerImagen devuelve una data URL', async () => {
    const { cliente } = preparar(binario(200, new Uint8Array([1, 2, 3]), 'image/webp'))
    expect(
      await cliente.obtenerImagen({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1 })
    ).toEqual({ ok: true, imagen: 'data:image/webp;base64,AQID' })
  })

  it('el 404 de imagen es imagen null y no un error', async () => {
    const { cliente } = preparar(json(404, { detail: 'No encontrado' }))
    expect(
      await cliente.obtenerImagen({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1 })
    ).toEqual({ ok: true, imagen: null })
  })

  it('una imagen con tipo no admitido es una respuesta inesperada', async () => {
    const { cliente } = preparar(binario(200, new Uint8Array([1]), 'image/svg+xml'))
    expect(
      await cliente.obtenerImagen({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1 })
    ).toEqual({ ok: false, error: 'error-inesperado' })
  })

  it('una respuesta con forma inesperada es error-inesperado', async () => {
    const { cliente } = preparar(json(200, { amigos: 'x' }))
    expect(await cliente.listar()).toEqual({ ok: false, error: 'error-inesperado' })
  })
})

describe('errores traducidos', () => {
  const textoDelBackend = 'detalle interno del backend tok-123'

  it('401 borra la sesion y devuelve sesion-vencida', async () => {
    const { cliente, sesion } = preparar(json(401, { detail: textoDelBackend }))
    expect(await cliente.listar()).toEqual({ ok: false, error: 'sesion-vencida' })
    expect(sesion.obtener()).toBeNull()
  })

  it.each([
    [404, 'no-encontrado'],
    [409, 'ya-existe'],
    [422, 'datos-invalidos'],
    [500, 'error-inesperado'],
    [403, 'error-inesperado']
  ])('el estado %i se traduce a %s sin texto del backend', async (estado, codigo) => {
    const { cliente } = preparar(json(estado, { detail: textoDelBackend }))
    const resultado = await cliente.enviarSolicitud({ usuarioId: USUARIO_ID })
    expect(resultado).toEqual({ ok: false, error: codigo })
    expect(JSON.stringify(resultado)).not.toContain('detalle interno')
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })

  it('un fallo de red es sin-conexion', async () => {
    const { cliente } = preparar(new Error('ECONNREFUSED'))
    expect(await cliente.listarTeams({ usuarioId: USUARIO_ID })).toEqual({
      ok: false,
      error: 'sin-conexion'
    })
  })

  it('un 401 en imagen tambien borra la sesion', async () => {
    const { cliente, sesion } = preparar(json(401))
    expect(
      await cliente.obtenerImagen({ usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1 })
    ).toEqual({ ok: false, error: 'sesion-vencida' })
    expect(sesion.obtener()).toBeNull()
  })
})
