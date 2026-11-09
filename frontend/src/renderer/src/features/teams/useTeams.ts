import { useCallback, useEffect, useRef, useState } from 'react'
import type { ErrorDeTeams, GrupoResumen, TeamResumen } from '../../../../shared/teams'

export type EstadoDeTeams =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly error: ErrorDeTeams }
  | {
      readonly tipo: 'listo'
      readonly teams: readonly TeamResumen[]
      readonly grupos: readonly GrupoResumen[]
    }

type Respuesta =
  | {
      readonly ok: true
      readonly teams?: readonly TeamResumen[]
      readonly grupos?: readonly GrupoResumen[]
    }
  | ErrorDeTeams

type Resultado = Promise<ErrorDeTeams | null>

export interface UseTeams {
  readonly estado: EstadoDeTeams
  readonly pendiente: boolean
  recargar(): Promise<void>
  crear(nombre: string): Resultado
  renombrar(teamId: string, nombre: string): Resultado
  cambiarVisibilidad(teamId: string, ocultoParaAmigos: boolean): Resultado
  elegirPortadaDeTeam(teamId: string, slot: number | null): Resultado
  borrar(teamId: string): Resultado
  crearGrupo(nombre: string): Resultado
  renombrarGrupo(grupoId: string, nombre: string): Resultado
  elegirPortadaDeGrupo(grupoId: string, teamId: string | null): Resultado
  borrarGrupo(grupoId: string): Resultado
  agregarTeam(grupoId: string, teamId: string): Resultado
  sacarTeam(grupoId: string, teamId: string): Resultado
  cambiarDeGrupo(team: Pick<TeamResumen, 'id' | 'grupoId'>, grupoId: string | null): Resultado
  ordenarGrupos(grupoIds: readonly string[]): Resultado
  ordenarTeamsDelGrupo(grupoId: string, teamIds: readonly string[]): Resultado
  ordenarSueltos(teamIds: readonly string[]): Resultado
}

export function useTeams(alSesionVencida: () => void): UseTeams {
  const [estado, setEstado] = useState<EstadoDeTeams>({ tipo: 'cargando' })
  const [pendiente, setPendiente] = useState(false)
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  const recargar = useCallback(async () => {
    const resultado = await window.aniimo.teams.listar()
    if (resultado.ok) {
      setEstado({ tipo: 'listo', teams: resultado.teams, grupos: resultado.grupos })
    } else if (resultado.error === 'sesion-vencida') {
      sesionVencida.current()
    } else {
      setEstado({ tipo: 'error', error: resultado })
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  // La vista solo cambia con la respuesta del backend: si la accion devuelve la foto
  // completa se usa esa, y si no se vuelve a pedir la lista.
  const ejecutar = useCallback(
    async (accion: () => Promise<Respuesta>): Resultado => {
      setPendiente(true)
      try {
        const resultado = await accion()
        if (!resultado.ok) {
          if (resultado.error === 'sesion-vencida') {
            sesionVencida.current()
          }
          return resultado
        }
        if (resultado.teams !== undefined && resultado.grupos !== undefined) {
          setEstado({ tipo: 'listo', teams: resultado.teams, grupos: resultado.grupos })
        } else {
          await recargar()
        }
        return null
      } finally {
        setPendiente(false)
      }
    },
    [recargar]
  )

  const crear = useCallback(
    (nombre: string) => ejecutar(() => window.aniimo.teams.crear({ nombre })),
    [ejecutar]
  )
  const renombrar = useCallback(
    (teamId: string, nombre: string) =>
      ejecutar(() => window.aniimo.teams.renombrar({ teamId, nombre })),
    [ejecutar]
  )
  const cambiarVisibilidad = useCallback(
    (teamId: string, ocultoParaAmigos: boolean) =>
      ejecutar(() => window.aniimo.teams.cambiarVisibilidad({ teamId, ocultoParaAmigos })),
    [ejecutar]
  )
  const elegirPortadaDeTeam = useCallback(
    (teamId: string, slot: number | null) =>
      ejecutar(() => window.aniimo.teams.elegirPortada({ teamId, slot })),
    [ejecutar]
  )
  const borrar = useCallback(
    (teamId: string) => ejecutar(() => window.aniimo.teams.borrar({ teamId })),
    [ejecutar]
  )
  const crearGrupo = useCallback(
    (nombre: string) => ejecutar(() => window.aniimo.grupos.crear({ nombre })),
    [ejecutar]
  )
  const renombrarGrupo = useCallback(
    (grupoId: string, nombre: string) =>
      ejecutar(() => window.aniimo.grupos.renombrar({ grupoId, nombre })),
    [ejecutar]
  )
  const elegirPortadaDeGrupo = useCallback(
    (grupoId: string, teamId: string | null) =>
      ejecutar(() => window.aniimo.grupos.elegirPortada({ grupoId, teamId })),
    [ejecutar]
  )
  const borrarGrupo = useCallback(
    (grupoId: string) => ejecutar(() => window.aniimo.grupos.borrar({ grupoId })),
    [ejecutar]
  )
  const agregarTeam = useCallback(
    (grupoId: string, teamId: string) =>
      ejecutar(() => window.aniimo.grupos.agregarTeam({ grupoId, teamId })),
    [ejecutar]
  )
  const sacarTeam = useCallback(
    (grupoId: string, teamId: string) =>
      ejecutar(() => window.aniimo.grupos.sacarTeam({ grupoId, teamId })),
    [ejecutar]
  )
  const cambiarDeGrupo = useCallback(
    (team: Pick<TeamResumen, 'id' | 'grupoId'>, grupoId: string | null): Resultado => {
      if (grupoId !== null) {
        return agregarTeam(grupoId, team.id)
      }
      return team.grupoId === null ? Promise.resolve(null) : sacarTeam(team.grupoId, team.id)
    },
    [agregarTeam, sacarTeam]
  )
  const ordenarGrupos = useCallback(
    (grupoIds: readonly string[]) => ejecutar(() => window.aniimo.grupos.ordenar({ grupoIds })),
    [ejecutar]
  )
  const ordenarTeamsDelGrupo = useCallback(
    (grupoId: string, teamIds: readonly string[]) =>
      ejecutar(() => window.aniimo.grupos.ordenarTeams({ grupoId, teamIds })),
    [ejecutar]
  )
  const ordenarSueltos = useCallback(
    (teamIds: readonly string[]) => ejecutar(() => window.aniimo.grupos.ordenarSueltos({ teamIds })),
    [ejecutar]
  )

  return {
    estado,
    pendiente,
    recargar,
    crear,
    renombrar,
    cambiarVisibilidad,
    elegirPortadaDeTeam,
    borrar,
    crearGrupo,
    renombrarGrupo,
    elegirPortadaDeGrupo,
    borrarGrupo,
    agregarTeam,
    sacarTeam,
    cambiarDeGrupo,
    ordenarGrupos,
    ordenarTeamsDelGrupo,
    ordenarSueltos
  }
}
