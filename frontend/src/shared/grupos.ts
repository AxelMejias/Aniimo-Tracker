import type { ResultadoListar } from './teams'

export const CANALES_GRUPOS = {
  crear: 'grupos:crear',
  renombrar: 'grupos:renombrar',
  elegirPortada: 'grupos:elegir-portada',
  borrar: 'grupos:borrar',
  agregarTeam: 'grupos:agregar-team',
  sacarTeam: 'grupos:sacar-team',
  ordenar: 'grupos:ordenar',
  ordenarTeams: 'grupos:ordenar-teams',
  ordenarSueltos: 'grupos:ordenar-sueltos'
} as const

export interface PedidoCrearGrupo {
  readonly nombre: string
}

export interface PedidoRenombrarGrupo {
  readonly grupoId: string
  readonly nombre: string
}

export interface PedidoElegirPortadaDeGrupo {
  readonly grupoId: string
  readonly teamId: string | null
}

export interface PedidoDeGrupo {
  readonly grupoId: string
}

export interface PedidoDeTeamEnGrupo {
  readonly grupoId: string
  readonly teamId: string
}

export interface PedidoOrdenarGrupos {
  readonly grupoIds: readonly string[]
}

export interface PedidoOrdenarTeams {
  readonly grupoId: string
  readonly teamIds: readonly string[]
}

export interface PedidoOrdenarSueltos {
  readonly teamIds: readonly string[]
}

export type ResultadoGrupos = ResultadoListar
