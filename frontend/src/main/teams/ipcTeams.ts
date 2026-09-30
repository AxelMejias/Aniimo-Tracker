import { CANALES_TEAMS, type ErrorDeTeams } from '../../shared/teams'
import type { EventoIpc, IpcPrincipal } from '../auth/ipcAuth'
import { isAllowedNavigation } from '../security'
import type { ClienteTeams } from './clienteTeams'
import {
  esPedidoCrear,
  esPedidoDeSlot,
  esPedidoDeTeam,
  esPedidoGuardarFicha,
  esPedidoRenombrar,
  validarPedidoDeImagen
} from './validacion'
import type {
  PedidoCrear,
  PedidoDeSlot,
  PedidoDeTeam,
  PedidoGuardarFicha,
  PedidoGuardarImagen,
  PedidoRenombrar
} from '../../shared/teams'

const DATOS_INVALIDOS: ErrorDeTeams = { ok: false, error: 'datos-invalidos' }
const IMAGEN_INVALIDA: ErrorDeTeams = { ok: false, error: 'imagen-invalida' }
const ERROR_INESPERADO: ErrorDeTeams = { ok: false, error: 'error-inesperado' }

export function registrarManejadoresDeTeams(
  ipc: IpcPrincipal,
  cliente: ClienteTeams,
  urlDeLaApp: string
): void {
  const remitenteValido = (evento: EventoIpc): boolean =>
    evento.senderFrame !== null && isAllowedNavigation(evento.senderFrame.url, urlDeLaApp)

  function registrar(
    canal: string,
    ejecutar: (payload: unknown) => Promise<unknown>
  ): void {
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

  function conPedido<T>(
    esValido: (valor: unknown) => valor is T,
    accion: (pedido: T) => Promise<unknown>
  ): (payload: unknown) => Promise<unknown> {
    return async (payload) => (esValido(payload) ? accion(payload) : DATOS_INVALIDOS)
  }

  registrar(CANALES_TEAMS.listar, () => cliente.listar())
  registrar(
    CANALES_TEAMS.crear,
    conPedido<PedidoCrear>(esPedidoCrear, (pedido) => cliente.crear(pedido))
  )
  registrar(
    CANALES_TEAMS.renombrar,
    conPedido<PedidoRenombrar>(esPedidoRenombrar, (pedido) => cliente.renombrar(pedido))
  )
  registrar(
    CANALES_TEAMS.borrar,
    conPedido<PedidoDeTeam>(esPedidoDeTeam, (pedido) => cliente.borrar(pedido))
  )
  registrar(
    CANALES_TEAMS.obtenerFicha,
    conPedido<PedidoDeSlot>(esPedidoDeSlot, (pedido) => cliente.obtenerFicha(pedido))
  )
  registrar(
    CANALES_TEAMS.guardarFicha,
    conPedido<PedidoGuardarFicha>(esPedidoGuardarFicha, (pedido) => cliente.guardarFicha(pedido))
  )
  registrar(
    CANALES_TEAMS.vaciarSlot,
    conPedido<PedidoDeSlot>(esPedidoDeSlot, (pedido) => cliente.vaciarSlot(pedido))
  )
  registrar(
    CANALES_TEAMS.obtenerImagen,
    conPedido<PedidoDeSlot>(esPedidoDeSlot, (pedido) => cliente.obtenerImagen(pedido))
  )
  registrar(CANALES_TEAMS.guardarImagen, async (payload) => {
    const clasificacion = validarPedidoDeImagen(payload)
    if (clasificacion === 'datos-invalidos') {
      return DATOS_INVALIDOS
    }
    if (clasificacion === 'imagen-invalida') {
      return IMAGEN_INVALIDA
    }
    return cliente.guardarImagen(payload as PedidoGuardarImagen)
  })
  registrar(
    CANALES_TEAMS.borrarImagen,
    conPedido<PedidoDeSlot>(esPedidoDeSlot, (pedido) => cliente.borrarImagen(pedido))
  )
}
