import { CANALES_TEAMS, type ErrorDeTeams } from '../../shared/teams'
import type { IpcPrincipal } from '../auth/ipcAuth'
import { crearRegistro } from '../ipcRegistro'
import type { ClienteTeams } from './clienteTeams'
import {
  esPedidoCambiarVisibilidad,
  esPedidoCrear,
  esPedidoDeSlot,
  esPedidoDeTeam,
  esPedidoGuardarFicha,
  esPedidoRenombrar,
  validarPedidoDeImagen
} from './validacion'
import type {
  PedidoCambiarVisibilidad,
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
  const { registrar, conPedido } = crearRegistro(ipc, urlDeLaApp, DATOS_INVALIDOS, ERROR_INESPERADO)

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
    CANALES_TEAMS.cambiarVisibilidad,
    conPedido<PedidoCambiarVisibilidad>(esPedidoCambiarVisibilidad, (pedido) =>
      cliente.cambiarVisibilidad(pedido)
    )
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
