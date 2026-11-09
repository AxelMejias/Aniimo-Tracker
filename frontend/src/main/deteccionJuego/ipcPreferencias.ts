import {
  CANALES_PREFERENCIAS,
  type ErrorDePreferencias,
  type PedidoCambiarPreferencia
} from '../../shared/preferencias'
import type { IpcPrincipal } from '../auth/ipcAuth'
import { crearRegistro } from '../ipcRegistro'
import { tieneClaves } from '../teams/validacion'
import type { ServicioDePreferencias } from './servicioDePreferencias'

const DATOS_INVALIDOS: ErrorDePreferencias = { ok: false, error: 'datos-invalidos' }
const ERROR_INESPERADO: ErrorDePreferencias = { ok: false, error: 'error-inesperado' }

function esPedidoCambiarPreferencia(valor: unknown): valor is PedidoCambiarPreferencia {
  return (
    tieneClaves(valor, ['clave', 'valor']) &&
    (valor.clave === 'abrirAppConElJuego' || valor.clave === 'arrancarConWindows') &&
    typeof valor.valor === 'boolean'
  )
}

export function registrarManejadoresDePreferencias(
  ipc: IpcPrincipal,
  servicio: Pick<ServicioDePreferencias, 'obtener' | 'cambiar'>,
  urlDeLaApp: string
): void {
  const { registrar, conPedido } = crearRegistro(ipc, urlDeLaApp, DATOS_INVALIDOS, ERROR_INESPERADO)

  registrar(CANALES_PREFERENCIAS.obtener, async () => ({
    ok: true,
    preferencias: await servicio.obtener()
  }))
  registrar(
    CANALES_PREFERENCIAS.cambiar,
    conPedido<PedidoCambiarPreferencia>(esPedidoCambiarPreferencia, async (pedido) => ({
      ok: true,
      preferencias: await servicio.cambiar(pedido.clave, pedido.valor)
    }))
  )
}
