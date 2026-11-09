import {
  MAXIMO_DE_TEAMS_POR_GRUPO,
  type GrupoResumen,
  type TeamResumen
} from '../../../../shared/teams'

export interface SeccionDeGrupoDatos {
  readonly grupo: GrupoResumen
  readonly teams: readonly TeamResumen[]
}

export interface Secciones {
  readonly grupos: readonly SeccionDeGrupoDatos[]
  readonly sueltos: readonly TeamResumen[]
}

export function armarSecciones(
  teams: readonly TeamResumen[],
  grupos: readonly GrupoResumen[]
): Secciones {
  const porId = new Map(teams.map((team) => [team.id, team]))
  const ordenados = [...grupos].sort((a, b) => a.orden - b.orden)
  return {
    grupos: ordenados.map((grupo) => ({
      grupo,
      teams: grupo.teamIds.flatMap((id) => porId.get(id) ?? [])
    })),
    sueltos: teams.filter((team) => team.grupoId === null).sort((a, b) => a.orden - b.orden)
  }
}

export interface OpcionDeGrupo {
  readonly id: string
  readonly nombre: string
}

export function opcionesDeGrupo(
  secciones: Secciones,
  grupoIdActual: string | null
): OpcionDeGrupo[] {
  return secciones.grupos
    .filter(
      ({ grupo, teams }) => grupo.id === grupoIdActual || teams.length < MAXIMO_DE_TEAMS_POR_GRUPO
    )
    .map(({ grupo }) => ({ id: grupo.id, nombre: grupo.nombre }))
}
