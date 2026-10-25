import {
  CANALES_AMIGOS,
  type ErrorDeAmigos,
  type PedidoBuscar,
  type PedidoDeSlotDeAmigo,
  type PedidoDeUsuario
} from '../../shared/amigos'
import type { IpcPrincipal } from '../auth/ipcAuth'
import { crearRegistro } from '../ipcRegistro'
import type { ClienteAmigos } from './clienteAmigos'
import { esPedidoBuscar, esPedidoDeSlotDeAmigo, esPedidoDeUsuario } from './validacion'

const DATOS_INVALIDOS: ErrorDeAmigos = { ok: false, error: 'datos-invalidos' }
const ERROR_INESPERADO: ErrorDeAmigos = { ok: false, error: 'error-inesperado' }

export function registrarManejadoresDeAmigos(
  ipc: IpcPrincipal,
  cliente: ClienteAmigos,
  urlDeLaApp: string
): void {
  const { registrar, conPedido } = crearRegistro(ipc, urlDeLaApp, DATOS_INVALIDOS, ERROR_INESPERADO)

  registrar(
    CANALES_AMIGOS.buscar,
    conPedido<PedidoBuscar>(esPedidoBuscar, (pedido) => cliente.buscar(pedido))
  )
  registrar(CANALES_AMIGOS.listar, () => cliente.listar())
  registrar(
    CANALES_AMIGOS.enviarSolicitud,
    conPedido<PedidoDeUsuario>(esPedidoDeUsuario, (pedido) => cliente.enviarSolicitud(pedido))
  )
  registrar(
    CANALES_AMIGOS.aceptarSolicitud,
    conPedido<PedidoDeUsuario>(esPedidoDeUsuario, (pedido) => cliente.aceptarSolicitud(pedido))
  )
  registrar(
    CANALES_AMIGOS.eliminar,
    conPedido<PedidoDeUsuario>(esPedidoDeUsuario, (pedido) => cliente.eliminar(pedido))
  )
  registrar(
    CANALES_AMIGOS.listarTeams,
    conPedido<PedidoDeUsuario>(esPedidoDeUsuario, (pedido) => cliente.listarTeams(pedido))
  )
  registrar(
    CANALES_AMIGOS.obtenerFicha,
    conPedido<PedidoDeSlotDeAmigo>(esPedidoDeSlotDeAmigo, (pedido) => cliente.obtenerFicha(pedido))
  )
  registrar(
    CANALES_AMIGOS.obtenerImagen,
    conPedido<PedidoDeSlotDeAmigo>(esPedidoDeSlotDeAmigo, (pedido) =>
      cliente.obtenerImagen(pedido)
    )
  )
}
