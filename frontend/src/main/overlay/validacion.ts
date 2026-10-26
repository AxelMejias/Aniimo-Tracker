import type { PedidoAbrirOverlay, PedidoSeleccionarOverlay } from '../../shared/overlay'
import { esIdDeTeam, tieneClaves } from '../teams/validacion'

export function esPedidoAbrirOverlay(valor: unknown): valor is PedidoAbrirOverlay {
  return tieneClaves(valor, ['teamId']) && esIdDeTeam(valor.teamId)
}

export function esPedidoSeleccionarOverlay(valor: unknown): valor is PedidoSeleccionarOverlay {
  return esPedidoAbrirOverlay(valor)
}
