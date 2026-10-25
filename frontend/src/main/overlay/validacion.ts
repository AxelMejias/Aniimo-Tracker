import type { PedidoAbrirOverlay } from '../../shared/overlay'
import { esIdDeTeam, tieneClaves } from '../teams/validacion'

export function esPedidoAbrirOverlay(valor: unknown): valor is PedidoAbrirOverlay {
  return tieneClaves(valor, ['teamId']) && esIdDeTeam(valor.teamId)
}
