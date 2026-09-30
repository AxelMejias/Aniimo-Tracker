import { describe, expect, it, vi } from 'vitest'
import { crearClienteBackend, URL_BASE_BACKEND, type FetchFn } from './clienteBackend'
import { crearSesionEnMemoria } from './sesionEnMemoria'

type Respuesta = Response | Error

function respuestaJson(
  estado: number,
  cuerpo?: unknown,
  cabeceras: Record<string, string> = {}
): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json', ...cabeceras }
  })
}

function prepararCliente(...respuestas: Respuesta[]) {
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
  const cliente = crearClienteBackend(fetchFalso, sesion)
  return { cliente, sesion, fetchFalso }
}

function cabecera(
  fetchFalso: ReturnType<typeof prepararCliente>['fetchFalso'],
  llamada: number,
  nombre: string
): string | null {
  const init = fetchFalso.mock.calls[llamada]?.[1]
  return new Headers(init?.headers).get(nombre)
}

const credenciales = { nombreUsuario: 'Axel', contrasena: 'una-clave-larga' }
const loginOk = (): Response =>
  respuestaJson(200, {
    access_token: 'tok-123',
    token_type: 'bearer',
    expira_en: '2030-01-01T00:00:00Z'
  })

describe('iniciarSesion', () => {
  it('guarda el token en la sesion en memoria y no lo devuelve', async () => {
    const { cliente, sesion } = prepararCliente(loginOk())
    const resultado = await cliente.iniciarSesion(credenciales)
    expect(resultado).toEqual({ ok: true, nombreUsuario: 'axel' })
    expect(sesion.obtener()).toEqual({ token: 'tok-123', nombreUsuario: 'axel' })
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })

  it('envia las credenciales al endpoint fijo de loopback', async () => {
    const { cliente, fetchFalso } = prepararCliente(loginOk())
    await cliente.iniciarSesion(credenciales)
    const [url, init] = fetchFalso.mock.calls[0] ?? []
    expect(String(url)).toBe(`${URL_BASE_BACKEND}/auth/login`)
    expect(URL_BASE_BACKEND).toBe('http://127.0.0.1:8000/api')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      nombre_usuario: 'Axel',
      contrasena: 'una-clave-larga'
    })
  })

  it('sin sesion en memoria la request no lleva Authorization', async () => {
    const { cliente, fetchFalso } = prepararCliente(loginOk())
    await cliente.iniciarSesion(credenciales)
    expect(cabecera(fetchFalso, 0, 'Authorization')).toBeNull()
  })

  it.each([
    [401, 'credenciales-invalidas'],
    [429, 'demasiados-intentos'],
    [422, 'datos-invalidos'],
    [500, 'error-inesperado']
  ])('traduce el estado %i a %s sin guardar sesion', async (estado, codigo) => {
    const { cliente, sesion } = prepararCliente(respuestaJson(estado, { detail: 'x' }))
    const resultado = await cliente.iniciarSesion(credenciales)
    expect(resultado).toMatchObject({ ok: false, error: codigo })
    expect(sesion.obtener()).toBeNull()
  })

  it('un 429 informa los segundos de Retry-After', async () => {
    const { cliente } = prepararCliente(
      respuestaJson(429, { detail: 'x' }, { 'Retry-After': '120' })
    )
    expect(await cliente.iniciarSesion(credenciales)).toEqual({
      ok: false,
      error: 'demasiados-intentos',
      reintentarEnSegundos: 120
    })
  })

  it('un 429 sin Retry-After valido no inventa segundos', async () => {
    const { cliente } = prepararCliente(
      respuestaJson(429, { detail: 'x' }, { 'Retry-After': 'pronto' })
    )
    expect(await cliente.iniciarSesion(credenciales)).toEqual({
      ok: false,
      error: 'demasiados-intentos'
    })
  })

  it('un 422 informa solo los nombres de campo, sin mensajes del backend', async () => {
    const detalle = [
      { loc: ['body', 'nombre_usuario'], msg: 'mensaje interno', type: 't' },
      { loc: ['body', 'contrasena'], msg: 'otro mensaje', type: 't' },
      { loc: ['body', 'contrasena'], msg: 'repetido', type: 't' }
    ]
    const { cliente } = prepararCliente(respuestaJson(422, { detail: detalle }))
    const resultado = await cliente.iniciarSesion(credenciales)
    expect(resultado).toEqual({
      ok: false,
      error: 'datos-invalidos',
      campos: ['nombre_usuario', 'contrasena']
    })
    expect(JSON.stringify(resultado)).not.toContain('mensaje')
  })

  it('un fallo de red devuelve sin-conexion', async () => {
    const { cliente, sesion } = prepararCliente(new TypeError('fetch failed'))
    expect(await cliente.iniciarSesion(credenciales)).toEqual({ ok: false, error: 'sin-conexion' })
    expect(sesion.obtener()).toBeNull()
  })

  it('una respuesta 200 sin token valido es error-inesperado', async () => {
    const { cliente, sesion } = prepararCliente(respuestaJson(200, { access_token: 42 }))
    expect(await cliente.iniciarSesion(credenciales)).toEqual({
      ok: false,
      error: 'error-inesperado'
    })
    expect(sesion.obtener()).toBeNull()
  })

  it('una respuesta que no es JSON es error-inesperado', async () => {
    const { cliente } = prepararCliente(new Response('<html>', { status: 200 }))
    expect(await cliente.iniciarSesion(credenciales)).toEqual({
      ok: false,
      error: 'error-inesperado'
    })
  })
})

describe('registrarse', () => {
  const creado = (): Response => respuestaJson(201, { id: 'u-1', nombre_usuario: 'axel' })

  it('registro 201 y login 200 dejan sesion y devuelven el nombre normalizado', async () => {
    const { cliente, sesion, fetchFalso } = prepararCliente(creado(), loginOk())
    expect(await cliente.registrarse(credenciales)).toEqual({ ok: true, nombreUsuario: 'axel' })
    expect(sesion.obtener()).toEqual({ token: 'tok-123', nombreUsuario: 'axel' })
    expect(String(fetchFalso.mock.calls[0]?.[0])).toBe(`${URL_BASE_BACKEND}/auth/register`)
    expect(String(fetchFalso.mock.calls[1]?.[0])).toBe(`${URL_BASE_BACKEND}/auth/login`)
  })

  it('registro 201 y login 429 devuelven demasiados-intentos sin sesion', async () => {
    const { cliente, sesion } = prepararCliente(
      creado(),
      respuestaJson(429, { detail: 'x' }, { 'Retry-After': '30' })
    )
    expect(await cliente.registrarse(credenciales)).toEqual({
      ok: false,
      error: 'demasiados-intentos',
      reintentarEnSegundos: 30
    })
    expect(sesion.obtener()).toBeNull()
  })

  it('un 409 devuelve nombre-no-disponible y no intenta el login', async () => {
    const { cliente, fetchFalso } = prepararCliente(respuestaJson(409, { detail: 'x' }))
    expect(await cliente.registrarse(credenciales)).toEqual({
      ok: false,
      error: 'nombre-no-disponible'
    })
    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('un 422 en el registro devuelve datos-invalidos con los campos', async () => {
    const { cliente } = prepararCliente(
      respuestaJson(422, { detail: [{ loc: ['body', 'contrasena'], msg: 'm', type: 't' }] })
    )
    expect(await cliente.registrarse(credenciales)).toEqual({
      ok: false,
      error: 'datos-invalidos',
      campos: ['contrasena']
    })
  })

  it('un 429 en el registro devuelve demasiados-intentos', async () => {
    const { cliente } = prepararCliente(
      respuestaJson(429, { detail: 'x' }, { 'Retry-After': '3600' })
    )
    expect(await cliente.registrarse(credenciales)).toEqual({
      ok: false,
      error: 'demasiados-intentos',
      reintentarEnSegundos: 3600
    })
  })

  it('un registro sin conexion devuelve sin-conexion', async () => {
    const { cliente } = prepararCliente(new TypeError('fetch failed'))
    expect(await cliente.registrarse(credenciales)).toEqual({ ok: false, error: 'sin-conexion' })
  })
})

describe('obtenerSesion', () => {
  it('sin sesion devuelve anonimo sin llamar al backend', async () => {
    const { cliente, fetchFalso } = prepararCliente()
    expect(await cliente.obtenerSesion()).toEqual({ ok: true, nombreUsuario: null })
    expect(fetchFalso).not.toHaveBeenCalled()
  })

  it('con sesion consulta el perfil con Authorization Bearer', async () => {
    const { cliente, sesion, fetchFalso } = prepararCliente(
      respuestaJson(200, { nombre_usuario: 'axel' })
    )
    sesion.guardar('tok-123', 'axel')
    expect(await cliente.obtenerSesion()).toEqual({ ok: true, nombreUsuario: 'axel' })
    expect(String(fetchFalso.mock.calls[0]?.[0])).toBe(`${URL_BASE_BACKEND}/auth/me`)
    expect(cabecera(fetchFalso, 0, 'Authorization')).toBe('Bearer tok-123')
  })

  it('un 401 borra la sesion y devuelve sesion-vencida', async () => {
    const { cliente, sesion } = prepararCliente(respuestaJson(401, { detail: 'No autenticado' }))
    sesion.guardar('tok-123', 'axel')
    expect(await cliente.obtenerSesion()).toEqual({ ok: false, error: 'sesion-vencida' })
    expect(sesion.obtener()).toBeNull()
  })

  it('un fallo de red conserva la sesion', async () => {
    const { cliente, sesion } = prepararCliente(new TypeError('fetch failed'))
    sesion.guardar('tok-123', 'axel')
    expect(await cliente.obtenerSesion()).toEqual({ ok: false, error: 'sin-conexion' })
    expect(sesion.obtener()).not.toBeNull()
  })
})

describe('cerrarSesion', () => {
  it('llama a logout con el token, borra la sesion y queda anonimo', async () => {
    const { cliente, sesion, fetchFalso } = prepararCliente(respuestaJson(204))
    sesion.guardar('tok-123', 'axel')
    expect(await cliente.cerrarSesion()).toEqual({ ok: true, nombreUsuario: null })
    expect(String(fetchFalso.mock.calls[0]?.[0])).toBe(`${URL_BASE_BACKEND}/auth/logout`)
    expect(cabecera(fetchFalso, 0, 'Authorization')).toBe('Bearer tok-123')
    expect(sesion.obtener()).toBeNull()
    expect(await cliente.obtenerSesion()).toEqual({ ok: true, nombreUsuario: null })
  })

  it('sin conexion borra igual la sesion local', async () => {
    const { cliente, sesion } = prepararCliente(new TypeError('fetch failed'))
    sesion.guardar('tok-123', 'axel')
    expect(await cliente.cerrarSesion()).toEqual({ ok: true, nombreUsuario: null })
    expect(sesion.obtener()).toBeNull()
  })

  it('con un 401 del backend borra igual la sesion local', async () => {
    const { cliente, sesion } = prepararCliente(respuestaJson(401, { detail: 'No autenticado' }))
    sesion.guardar('tok-123', 'axel')
    await cliente.cerrarSesion()
    expect(sesion.obtener()).toBeNull()
  })

  it('sin sesion no llama al backend', async () => {
    const { cliente, fetchFalso } = prepararCliente()
    expect(await cliente.cerrarSesion()).toEqual({ ok: true, nombreUsuario: null })
    expect(fetchFalso).not.toHaveBeenCalled()
  })
})
