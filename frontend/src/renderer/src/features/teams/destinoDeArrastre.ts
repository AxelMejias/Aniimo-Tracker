import { MAXIMO_DE_TEAMS_POR_GRUPO } from '../../../../shared/teams'
import type { Secciones } from './secciones'

export type Arrastrado = { readonly tipo: 'grupo' | 'team'; readonly id: string }

export type Objetivo =
  | { readonly tipo: 'grupo'; readonly id: string }
  | { readonly tipo: 'team'; readonly id: string }
  | { readonly tipo: 'sin-grupo' }

export type Destino =
  | { readonly tipo: 'ordenar-grupos'; readonly grupoIds: readonly string[] }
  | {
      readonly tipo: 'ordenar-teams'
      readonly grupoId: string
      readonly teamIds: readonly string[]
    }
  | { readonly tipo: 'ordenar-sueltos'; readonly teamIds: readonly string[] }
  | { readonly tipo: 'agregar'; readonly grupoId: string; readonly teamId: string }
  | { readonly tipo: 'sacar'; readonly grupoId: string; readonly teamId: string }

export type Direccion = 'subir' | 'bajar'

function moverA(ids: readonly string[], id: string, objetivoId: string): string[] | null {
  const destino = ids.indexOf(objetivoId)
  if (!ids.includes(id) || destino === -1 || id === objetivoId) {
    return null
  }
  const resto = ids.filter((candidato) => candidato !== id)
  resto.splice(destino, 0, id)
  return resto
}

function intercambiar(ids: readonly string[], id: string, direccion: Direccion): string[] | null {
  const posicion = ids.indexOf(id)
  const vecino = direccion === 'subir' ? posicion - 1 : posicion + 1
  if (posicion === -1 || vecino < 0 || vecino >= ids.length) {
    return null
  }
  const copia = [...ids]
  const actual = copia[posicion] as string
  copia[posicion] = copia[vecino] as string
  copia[vecino] = actual
  return copia
}

function ambitoDelTeam(secciones: Secciones, teamId: string): string | null | undefined {
  for (const { grupo, teams } of secciones.grupos) {
    if (teams.some((team) => team.id === teamId)) {
      return grupo.id
    }
  }
  return secciones.sueltos.some((team) => team.id === teamId) ? null : undefined
}

function ordenarAmbito(
  secciones: Secciones,
  ambito: string | null,
  reordenar: (ids: readonly string[]) => string[] | null
): Destino | null {
  if (ambito === null) {
    const teamIds = reordenar(secciones.sueltos.map((team) => team.id))
    return teamIds === null ? null : { tipo: 'ordenar-sueltos', teamIds }
  }
  const seccion = secciones.grupos.find(({ grupo }) => grupo.id === ambito)
  const teamIds = reordenar(seccion?.teams.map((team) => team.id) ?? [])
  return teamIds === null ? null : { tipo: 'ordenar-teams', grupoId: ambito, teamIds }
}

function destinoDeTeamEnGrupo(
  secciones: Secciones,
  teamId: string,
  origen: string | null,
  grupoId: string
): Destino | null {
  const seccion = secciones.grupos.find(({ grupo }) => grupo.id === grupoId)
  if (seccion === undefined || origen === grupoId || seccion.teams.length >= MAXIMO_DE_TEAMS_POR_GRUPO) {
    return null
  }
  return { tipo: 'agregar', grupoId, teamId }
}

function destinoDeTeam(secciones: Secciones, teamId: string, objetivo: Objetivo): Destino | null {
  const origen = ambitoDelTeam(secciones, teamId)
  if (origen === undefined) {
    return null
  }
  const ambitoDelObjetivo =
    objetivo.tipo === 'team'
      ? ambitoDelTeam(secciones, objetivo.id)
      : objetivo.tipo === 'grupo'
        ? objetivo.id
        : null
  if (ambitoDelObjetivo === undefined) {
    return null
  }
  if (ambitoDelObjetivo === origen) {
    if (objetivo.tipo !== 'team') {
      return null
    }
    return ordenarAmbito(secciones, origen, (ids) => moverA(ids, teamId, objetivo.id))
  }
  if (ambitoDelObjetivo === null) {
    return origen === null ? null : { tipo: 'sacar', grupoId: origen, teamId }
  }
  return destinoDeTeamEnGrupo(secciones, teamId, origen, ambitoDelObjetivo)
}

export function destinoDeSoltar(
  secciones: Secciones,
  arrastrado: Arrastrado,
  objetivo: Objetivo
): Destino | null {
  if (arrastrado.tipo === 'team') {
    return destinoDeTeam(secciones, arrastrado.id, objetivo)
  }
  if (objetivo.tipo !== 'grupo') {
    return null
  }
  const ids = secciones.grupos.map(({ grupo }) => grupo.id)
  const grupoIds = moverA(ids, arrastrado.id, objetivo.id)
  return grupoIds === null ? null : { tipo: 'ordenar-grupos', grupoIds }
}

export function destinoDeMovimiento(
  secciones: Secciones,
  arrastrado: Arrastrado,
  direccion: Direccion
): Destino | null {
  if (arrastrado.tipo === 'grupo') {
    const ids = secciones.grupos.map(({ grupo }) => grupo.id)
    const grupoIds = intercambiar(ids, arrastrado.id, direccion)
    return grupoIds === null ? null : { tipo: 'ordenar-grupos', grupoIds }
  }
  const ambito = ambitoDelTeam(secciones, arrastrado.id)
  if (ambito === undefined) {
    return null
  }
  return ordenarAmbito(secciones, ambito, (ids) => intercambiar(ids, arrastrado.id, direccion))
}
