import {
  CANALES_GRUPOS,
  type PedidoCrearGrupo,
  type PedidoDeGrupo,
  type PedidoDeTeamEnGrupo,
  type PedidoElegirPortadaDeGrupo,
  type PedidoOrdenarGrupos,
  type PedidoOrdenarSueltos,
  type PedidoOrdenarTeams,
  type PedidoRenombrarGrupo
} from '../../shared/grupos'
import type { ErrorDeTeams } from '../../shared/teams'
import type { IpcPrincipal } from '../auth/ipcAuth'
import { crearRegistro } from '../ipcRegistro'
import type { ClienteGrupos } from './clienteGrupos'
import {
  esPedidoCrearGrupo,
  esPedidoDeGrupo,
  esPedidoDeTeamEnGrupo,
  esPedidoElegirPortadaDeGrupo,
  esPedidoOrdenarGrupos,
  esPedidoOrdenarSueltos,
  esPedidoOrdenarTeams,
  esPedidoRenombrarGrupo
} from './validacion'

const DATOS_INVALIDOS: ErrorDeTeams = { ok: false, error: 'datos-invalidos' }
const ERROR_INESPERADO: ErrorDeTeams = { ok: false, error: 'error-inesperado' }

export function registrarManejadoresDeGrupos(
  ipc: IpcPrincipal,
  cliente: ClienteGrupos,
  urlDeLaApp: string
): void {
  const { registrar, conPedido } = crearRegistro(ipc, urlDeLaApp, DATOS_INVALIDOS, ERROR_INESPERADO)

  registrar(
    CANALES_GRUPOS.crear,
    conPedido<PedidoCrearGrupo>(esPedidoCrearGrupo, (pedido) => cliente.crear(pedido))
  )
  registrar(
    CANALES_GRUPOS.renombrar,
    conPedido<PedidoRenombrarGrupo>(esPedidoRenombrarGrupo, (pedido) => cliente.renombrar(pedido))
  )
  registrar(
    CANALES_GRUPOS.elegirPortada,
    conPedido<PedidoElegirPortadaDeGrupo>(esPedidoElegirPortadaDeGrupo, (pedido) =>
      cliente.elegirPortada(pedido)
    )
  )
  registrar(
    CANALES_GRUPOS.borrar,
    conPedido<PedidoDeGrupo>(esPedidoDeGrupo, (pedido) => cliente.borrar(pedido))
  )
  registrar(
    CANALES_GRUPOS.agregarTeam,
    conPedido<PedidoDeTeamEnGrupo>(esPedidoDeTeamEnGrupo, (pedido) => cliente.agregarTeam(pedido))
  )
  registrar(
    CANALES_GRUPOS.sacarTeam,
    conPedido<PedidoDeTeamEnGrupo>(esPedidoDeTeamEnGrupo, (pedido) => cliente.sacarTeam(pedido))
  )
  registrar(
    CANALES_GRUPOS.ordenar,
    conPedido<PedidoOrdenarGrupos>(esPedidoOrdenarGrupos, (pedido) => cliente.ordenar(pedido))
  )
  registrar(
    CANALES_GRUPOS.ordenarTeams,
    conPedido<PedidoOrdenarTeams>(esPedidoOrdenarTeams, (pedido) => cliente.ordenarTeams(pedido))
  )
  registrar(
    CANALES_GRUPOS.ordenarSueltos,
    conPedido<PedidoOrdenarSueltos>(esPedidoOrdenarSueltos, (pedido) =>
      cliente.ordenarSueltos(pedido)
    )
  )
}
