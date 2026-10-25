import {
  CANALES_CALCULO,
  type ErrorDeCalculo,
  type PedidoCalcular,
  type PedidoPotencial
} from '../../shared/calculo'
import type { IpcPrincipal } from '../auth/ipcAuth'
import { crearRegistro } from '../ipcRegistro'
import type { ClienteCalculo } from './clienteCalculo'
import { esPedidoCalcular, esPedidoPotencial } from './validacion'

const DATOS_INVALIDOS: ErrorDeCalculo = { ok: false, error: 'datos-invalidos' }
const ERROR_INESPERADO: ErrorDeCalculo = { ok: false, error: 'error-inesperado' }

export function registrarManejadoresDeCalculo(
  ipc: IpcPrincipal,
  cliente: ClienteCalculo,
  urlDeLaApp: string
): void {
  const { registrar, conPedido } = crearRegistro(ipc, urlDeLaApp, DATOS_INVALIDOS, ERROR_INESPERADO)

  registrar(CANALES_CALCULO.obtenerCatalogo, () => cliente.obtenerCatalogo())
  registrar(
    CANALES_CALCULO.calcular,
    conPedido<PedidoCalcular>(esPedidoCalcular, (pedido) => cliente.calcular(pedido))
  )
  registrar(
    CANALES_CALCULO.potencial,
    conPedido<PedidoPotencial>(esPedidoPotencial, (pedido) => cliente.potencial(pedido))
  )
}
