import type { EventoIpc, IpcPrincipal } from './auth/ipcAuth'
import { isAllowedNavigation } from './security'

export interface Registro {
  registrar(canal: string, ejecutar: (payload: unknown) => Promise<unknown>): void
  conPedido<T>(
    esValido: (valor: unknown) => valor is T,
    accion: (pedido: T) => Promise<unknown>
  ): (payload: unknown) => Promise<unknown>
}

export function crearRegistro<E>(
  ipc: IpcPrincipal,
  urlDeLaApp: string,
  datosInvalidos: E,
  errorInesperado: E
): Registro {
  const remitenteValido = (evento: EventoIpc): boolean =>
    evento.senderFrame !== null && isAllowedNavigation(evento.senderFrame.url, urlDeLaApp)

  return {
    registrar(canal, ejecutar) {
      ipc.handle(canal, async (evento, payload) => {
        if (!remitenteValido(evento)) {
          return datosInvalidos
        }
        try {
          return await ejecutar(payload)
        } catch {
          return errorInesperado
        }
      })
    },
    conPedido(esValido, accion) {
      return async (payload) => (esValido(payload) ? accion(payload) : datosInvalidos)
    }
  }
}
