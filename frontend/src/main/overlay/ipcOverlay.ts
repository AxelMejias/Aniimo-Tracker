import {
  CANALES_OVERLAY,
  type ErrorDeOverlay,
  type PedidoAbrirOverlay,
  type PedidoSeleccionarOverlay
} from '../../shared/overlay'
import type { IpcPrincipal } from '../auth/ipcAuth'
import { crearRegistro } from '../ipcRegistro'
import type { ControladorOverlay } from './controladorOverlay'
import { esPedidoAbrirOverlay, esPedidoSeleccionarOverlay } from './validacion'

const DATOS_INVALIDOS: ErrorDeOverlay = { ok: false, error: 'datos-invalidos' }
const ERROR_INESPERADO: ErrorDeOverlay = { ok: false, error: 'error-inesperado' }

export function registrarManejadoresDeOverlay(
  ipc: IpcPrincipal,
  controlador: ControladorOverlay,
  urlDeLaApp: string
): void {
  const { registrar, conPedido } = crearRegistro(ipc, urlDeLaApp, DATOS_INVALIDOS, ERROR_INESPERADO)

  registrar(
    CANALES_OVERLAY.abrir,
    conPedido<PedidoAbrirOverlay>(esPedidoAbrirOverlay, (pedido) =>
      controlador.abrir(pedido.teamId)
    )
  )
  registrar(
    CANALES_OVERLAY.seleccionar,
    conPedido<PedidoSeleccionarOverlay>(esPedidoSeleccionarOverlay, async (pedido) =>
      controlador.seleccionar(pedido.teamId)
    )
  )
  registrar(CANALES_OVERLAY.cerrar, async () => {
    controlador.cerrar()
    return { ok: true }
  })
  registrar(CANALES_OVERLAY.obtenerSeleccion, async () => ({
    ok: true,
    seleccion: controlador.seleccion()
  }))
}
