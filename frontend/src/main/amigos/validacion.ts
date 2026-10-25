import {
  PATRON_DE_NOMBRE_DE_USUARIO,
  type PedidoBuscar,
  type PedidoDeSlotDeAmigo,
  type PedidoDeUsuario
} from '../../shared/amigos'
import { esIdDeTeam, esSlot, tieneClaves } from '../teams/validacion'

export function esPedidoBuscar(valor: unknown): valor is PedidoBuscar {
  return (
    tieneClaves(valor, ['nombreUsuario']) &&
    typeof valor.nombreUsuario === 'string' &&
    PATRON_DE_NOMBRE_DE_USUARIO.test(valor.nombreUsuario)
  )
}

export function esPedidoDeUsuario(valor: unknown): valor is PedidoDeUsuario {
  return tieneClaves(valor, ['usuarioId']) && esIdDeTeam(valor.usuarioId)
}

export function esPedidoDeSlotDeAmigo(valor: unknown): valor is PedidoDeSlotDeAmigo {
  return (
    tieneClaves(valor, ['usuarioId', 'teamId', 'slot']) &&
    esIdDeTeam(valor.usuarioId) &&
    esIdDeTeam(valor.teamId) &&
    esSlot(valor.slot)
  )
}
