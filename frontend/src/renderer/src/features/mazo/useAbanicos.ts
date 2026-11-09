import { useCallback, useState } from 'react'

export interface Abanicos {
  readonly abierto: string | null
  readonly sobre: string | null
  readonly teamAbierto: string | null
  readonly teamSobre: string | null
  estaAbierto(grupoId: string): boolean
  alternar(grupoId: string): void
  entrar(grupoId: string): void
  salir(grupoId: string): void
  plegar(): void
  alternarTeam(teamId: string): void
  entrarTeam(teamId: string): void
  salirTeam(teamId: string): void
  plegarTeam(): void
}

export function useAbanicos(fijadoInicial: string | null = null): Abanicos {
  const [fijado, setFijado] = useState<string | null>(fijadoInicial)
  const [sobre, setSobre] = useState<string | null>(null)
  const [teamFijado, setTeamFijado] = useState<string | null>(null)
  const [teamSobre, setTeamSobre] = useState<string | null>(null)
  const abierto = fijado ?? sobre
  const teamAbierto = teamFijado ?? teamSobre

  const alternar = useCallback((grupoId: string) => {
    setFijado((actual) => (actual === grupoId ? null : grupoId))
    setSobre((actual) => (actual === grupoId ? null : actual))
  }, [])
  const entrar = useCallback((grupoId: string) => setSobre(grupoId), [])
  const salir = useCallback(
    (grupoId: string) => setSobre((actual) => (actual === grupoId ? null : actual)),
    []
  )
  const plegar = useCallback(() => {
    setFijado(null)
    setSobre(null)
    setTeamFijado(null)
    setTeamSobre(null)
  }, [])

  const alternarTeam = useCallback((teamId: string) => {
    setTeamFijado((actual) => (actual === teamId ? null : teamId))
    setTeamSobre((actual) => (actual === teamId ? null : actual))
  }, [])
  const entrarTeam = useCallback((teamId: string) => {
    setTeamFijado(null)
    setTeamSobre(teamId)
  }, [])
  const salirTeam = useCallback(
    (teamId: string) => setTeamSobre((actual) => (actual === teamId ? null : actual)),
    []
  )
  const plegarTeam = useCallback(() => {
    setTeamFijado(null)
    setTeamSobre(null)
  }, [])

  return {
    abierto,
    sobre,
    teamAbierto,
    teamSobre,
    estaAbierto: (grupoId) => abierto === grupoId,
    alternar,
    entrar,
    salir,
    plegar,
    alternarTeam,
    entrarTeam,
    salirTeam,
    plegarTeam
  }
}
