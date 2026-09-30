import type {
  CodigoDeError,
  Credenciales,
  ErrorDeAuth,
  ResultadoAuth,
  ResultadoSesion
} from '../../shared/auth'
import type { SesionEnMemoria } from './sesionEnMemoria'

export const URL_BASE_BACKEND = 'http://127.0.0.1:8000/api'
const TIEMPO_MAXIMO_MS = 10_000

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>

export interface ClienteBackend {
  registrarse(credenciales: Credenciales): Promise<ResultadoAuth>
  iniciarSesion(credenciales: Credenciales): Promise<ResultadoAuth>
  cerrarSesion(): Promise<ResultadoSesion>
  obtenerSesion(): Promise<ResultadoSesion>
}

function error(codigo: CodigoDeError, extra: Partial<ErrorDeAuth> = {}): ErrorDeAuth {
  return { ok: false, error: codigo, ...extra }
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json()
  } catch {
    return undefined
  }
}

async function camposConError(respuesta: Response): Promise<readonly string[]> {
  const cuerpo = await leerJson(respuesta)
  const detalle = esRegistro(cuerpo) ? cuerpo.detail : undefined
  if (!Array.isArray(detalle)) {
    return []
  }
  const campos = new Set<string>()
  for (const item of detalle) {
    const loc = esRegistro(item) ? item.loc : undefined
    if (Array.isArray(loc) && loc[0] === 'body' && typeof loc[1] === 'string') {
      campos.add(loc[1])
    }
  }
  return [...campos]
}

function segundosDeEspera(respuesta: Response): number | undefined {
  const valor = respuesta.headers.get('Retry-After')
  if (valor === null || !/^\d+$/.test(valor)) {
    return undefined
  }
  return Number(valor)
}

async function errorDeRespuesta(respuesta: Response): Promise<ErrorDeAuth> {
  switch (respuesta.status) {
    case 401:
      return error('credenciales-invalidas')
    case 409:
      return error('nombre-no-disponible')
    case 422:
      return error('datos-invalidos', { campos: await camposConError(respuesta) })
    case 429: {
      const segundos = segundosDeEspera(respuesta)
      return segundos === undefined
        ? error('demasiados-intentos')
        : error('demasiados-intentos', { reintentarEnSegundos: segundos })
    }
    default:
      return error('error-inesperado')
  }
}

export function crearClienteBackend(fetchFn: FetchFn, sesion: SesionEnMemoria): ClienteBackend {
  async function pedir(
    metodo: 'GET' | 'POST',
    ruta: string,
    cuerpo?: unknown
  ): Promise<Response | ErrorDeAuth> {
    const cabeceras: Record<string, string> = {}
    if (cuerpo !== undefined) {
      cabeceras['Content-Type'] = 'application/json'
    }
    const actual = sesion.obtener()
    if (actual !== null) {
      cabeceras.Authorization = `Bearer ${actual.token}`
    }
    try {
      return await fetchFn(`${URL_BASE_BACKEND}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS)
      })
    } catch {
      return error('sin-conexion')
    }
  }

  async function iniciarSesion(credenciales: Credenciales): Promise<ResultadoAuth> {
    const respuesta = await pedir('POST', '/auth/login', {
      nombre_usuario: credenciales.nombreUsuario,
      contrasena: credenciales.contrasena
    })
    if (!(respuesta instanceof Response)) {
      return respuesta
    }
    if (respuesta.status !== 200) {
      return errorDeRespuesta(respuesta)
    }
    const cuerpo = await leerJson(respuesta)
    const token = esRegistro(cuerpo) ? cuerpo.access_token : undefined
    if (typeof token !== 'string' || token === '') {
      return error('error-inesperado')
    }
    const nombreUsuario = credenciales.nombreUsuario.toLowerCase()
    sesion.guardar(token, nombreUsuario)
    return { ok: true, nombreUsuario }
  }

  async function registrarse(credenciales: Credenciales): Promise<ResultadoAuth> {
    const respuesta = await pedir('POST', '/auth/register', {
      nombre_usuario: credenciales.nombreUsuario,
      contrasena: credenciales.contrasena
    })
    if (!(respuesta instanceof Response)) {
      return respuesta
    }
    if (respuesta.status !== 201) {
      return errorDeRespuesta(respuesta)
    }
    return iniciarSesion(credenciales)
  }

  async function cerrarSesion(): Promise<ResultadoSesion> {
    if (sesion.obtener() !== null) {
      await pedir('POST', '/auth/logout')
      sesion.borrar()
    }
    return { ok: true, nombreUsuario: null }
  }

  async function obtenerSesion(): Promise<ResultadoSesion> {
    if (sesion.obtener() === null) {
      return { ok: true, nombreUsuario: null }
    }
    const respuesta = await pedir('GET', '/auth/me')
    if (!(respuesta instanceof Response)) {
      return respuesta
    }
    if (respuesta.status === 401) {
      sesion.borrar()
      return error('sesion-vencida')
    }
    if (respuesta.status !== 200) {
      return error('error-inesperado')
    }
    const cuerpo = await leerJson(respuesta)
    const nombre = esRegistro(cuerpo) ? cuerpo.nombre_usuario : undefined
    return typeof nombre === 'string' ? { ok: true, nombreUsuario: nombre } : error('error-inesperado')
  }

  return { registrarse, iniciarSesion, cerrarSesion, obtenerSesion }
}
