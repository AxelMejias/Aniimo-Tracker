import { CANALES_AUTH, type Credenciales, type ErrorDeAuth } from '../../shared/auth'
import { isAllowedNavigation } from '../security'
import type { ClienteBackend } from './clienteBackend'
import { esCredenciales } from './validacion'

export interface EventoIpc {
  readonly senderFrame: { readonly url: string } | null
}

export interface IpcPrincipal {
  handle(
    canal: string,
    manejador: (evento: EventoIpc, payload?: unknown) => Promise<unknown>
  ): void
}

const DATOS_INVALIDOS: ErrorDeAuth = { ok: false, error: 'datos-invalidos' }
const ERROR_INESPERADO: ErrorDeAuth = { ok: false, error: 'error-inesperado' }

export function registrarManejadoresDeAuth(
  ipc: IpcPrincipal,
  cliente: ClienteBackend,
  urlDeLaApp: string
): void {
  const remitenteValido = (evento: EventoIpc): boolean =>
    evento.senderFrame !== null && isAllowedNavigation(evento.senderFrame.url, urlDeLaApp)

  function registrar(canal: string, ejecutar: (payload: unknown) => Promise<unknown>): void {
    ipc.handle(canal, async (evento, payload) => {
      if (!remitenteValido(evento)) {
        return DATOS_INVALIDOS
      }
      try {
        return await ejecutar(payload)
      } catch {
        return ERROR_INESPERADO
      }
    })
  }

  function conCredenciales(
    accion: (credenciales: Credenciales) => Promise<unknown>
  ): (payload: unknown) => Promise<unknown> {
    return async (payload) => (esCredenciales(payload) ? accion(payload) : DATOS_INVALIDOS)
  }

  registrar(
    CANALES_AUTH.registrarse,
    conCredenciales((credenciales) => cliente.registrarse(credenciales))
  )
  registrar(
    CANALES_AUTH.iniciarSesion,
    conCredenciales((credenciales) => cliente.iniciarSesion(credenciales))
  )
  registrar(CANALES_AUTH.cerrarSesion, () => cliente.cerrarSesion())
  registrar(CANALES_AUTH.obtenerSesion, () => cliente.obtenerSesion())
}
