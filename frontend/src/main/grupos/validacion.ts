import {
  MAXIMO_DE_GRUPOS,
  MAXIMO_DE_TEAMS,
  MAXIMO_DE_TEAMS_POR_GRUPO,
  LARGO_MAXIMO_NOMBRE_CORTO
} from '../../shared/teams'
import type {
  PedidoCrearGrupo,
  PedidoDeGrupo,
  PedidoDeTeamEnGrupo,
  PedidoElegirPortadaDeGrupo,
  PedidoOrdenarGrupos,
  PedidoOrdenarSueltos,
  PedidoOrdenarTeams,
  PedidoRenombrarGrupo
} from '../../shared/grupos'
import { esIdDeTeam, tieneClaves } from '../teams/validacion'

function esNombre(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= LARGO_MAXIMO_NOMBRE_CORTO
}

function esListaDeIds(valor: unknown, maximo: number): valor is string[] {
  return (
    Array.isArray(valor) &&
    valor.length >= 1 &&
    valor.length <= maximo &&
    valor.every(esIdDeTeam) &&
    new Set(valor).size === valor.length
  )
}

export function esPedidoCrearGrupo(valor: unknown): valor is PedidoCrearGrupo {
  return tieneClaves(valor, ['nombre']) && esNombre(valor.nombre)
}

export function esPedidoRenombrarGrupo(valor: unknown): valor is PedidoRenombrarGrupo {
  return (
    tieneClaves(valor, ['grupoId', 'nombre']) && esIdDeTeam(valor.grupoId) && esNombre(valor.nombre)
  )
}

export function esPedidoElegirPortadaDeGrupo(valor: unknown): valor is PedidoElegirPortadaDeGrupo {
  return (
    tieneClaves(valor, ['grupoId', 'teamId']) &&
    esIdDeTeam(valor.grupoId) &&
    (valor.teamId === null || esIdDeTeam(valor.teamId))
  )
}

export function esPedidoDeGrupo(valor: unknown): valor is PedidoDeGrupo {
  return tieneClaves(valor, ['grupoId']) && esIdDeTeam(valor.grupoId)
}

export function esPedidoDeTeamEnGrupo(valor: unknown): valor is PedidoDeTeamEnGrupo {
  return (
    tieneClaves(valor, ['grupoId', 'teamId']) && esIdDeTeam(valor.grupoId) && esIdDeTeam(valor.teamId)
  )
}

export function esPedidoOrdenarGrupos(valor: unknown): valor is PedidoOrdenarGrupos {
  return tieneClaves(valor, ['grupoIds']) && esListaDeIds(valor.grupoIds, MAXIMO_DE_GRUPOS)
}

export function esPedidoOrdenarTeams(valor: unknown): valor is PedidoOrdenarTeams {
  return (
    tieneClaves(valor, ['grupoId', 'teamIds']) &&
    esIdDeTeam(valor.grupoId) &&
    esListaDeIds(valor.teamIds, MAXIMO_DE_TEAMS_POR_GRUPO)
  )
}

export function esPedidoOrdenarSueltos(valor: unknown): valor is PedidoOrdenarSueltos {
  return tieneClaves(valor, ['teamIds']) && esListaDeIds(valor.teamIds, MAXIMO_DE_TEAMS)
}
