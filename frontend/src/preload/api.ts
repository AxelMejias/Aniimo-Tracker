import {
  CANALES_AUTH,
  type Credenciales,
  type ResultadoAuth,
  type ResultadoSesion
} from '../shared/auth'

export type Invocar = (canal: string, ...args: unknown[]) => Promise<unknown>

export interface AuthApi {
  registrarse(credenciales: Credenciales): Promise<ResultadoAuth>
  iniciarSesion(credenciales: Credenciales): Promise<ResultadoAuth>
  cerrarSesion(): Promise<ResultadoSesion>
  obtenerSesion(): Promise<ResultadoSesion>
}

export interface AniimoApi {
  readonly appName: string
  readonly auth: Readonly<AuthApi>
}

// El main valida remitente y payload y solo responde con estos tipos.
function tipado<T>(promesa: Promise<unknown>): Promise<T> {
  return promesa as Promise<T>
}

export function buildExposedApi(invocar: Invocar): Readonly<AniimoApi> {
  const auth: AuthApi = {
    registrarse: (credenciales) =>
      tipado(invocar(CANALES_AUTH.registrarse, credenciales)),
    iniciarSesion: (credenciales) =>
      tipado(invocar(CANALES_AUTH.iniciarSesion, credenciales)),
    cerrarSesion: () => tipado(invocar(CANALES_AUTH.cerrarSesion)),
    obtenerSesion: () => tipado(invocar(CANALES_AUTH.obtenerSesion))
  }
  return Object.freeze({
    appName: 'Aniimo Team Tracker',
    auth: Object.freeze(auth)
  })
}
