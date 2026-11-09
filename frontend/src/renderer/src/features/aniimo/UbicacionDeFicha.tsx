import { useEffect, useState, type ReactElement } from 'react'

export interface Ubicacion {
  readonly teamNombre: string
  readonly grupo: { readonly id: string; readonly nombre: string } | null
  readonly esPortada: boolean
}

export interface NavegacionDeFicha {
  readonly alIrAMisTeams: (grupoId?: string) => void
  readonly alIrAlTeam: () => void
}

export function useUbicacionDeFicha(teamId: string, slot: number): Ubicacion | null {
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)

  useEffect(() => {
    let activo = true
    void window.aniimo.teams.listar().then((resultado) => {
      if (!activo || !resultado.ok) {
        return
      }
      const team = resultado.teams.find((candidato) => candidato.id === teamId)
      if (team === undefined) {
        return
      }
      const grupo = resultado.grupos.find((candidato) => candidato.id === team.grupoId)
      setUbicacion({
        teamNombre: team.nombre,
        grupo: grupo === undefined ? null : { id: grupo.id, nombre: grupo.nombre },
        esPortada: team.portadaEfectivaSlot === slot
      })
    })
    return () => {
      activo = false
    }
  }, [teamId, slot])

  return ubicacion
}

interface MigasDeFichaProps {
  readonly slot: number
  readonly ubicacion: Ubicacion | null
  readonly navegacion: NavegacionDeFicha
}

export function MigasDeFicha({ slot, ubicacion, navegacion }: MigasDeFichaProps): ReactElement {
  return (
    <nav className="ficha__migas" aria-label="Ubicación">
      <button type="button" onClick={() => navegacion.alIrAMisTeams()}>
        Mis teams
      </button>
      {ubicacion?.grupo !== undefined && ubicacion.grupo !== null && (
        <>
          <span aria-hidden="true">›</span>
          <button
            type="button"
            onClick={() => navegacion.alIrAMisTeams(ubicacion.grupo?.id)}
          >
            {ubicacion.grupo.nombre}
          </button>
        </>
      )}
      {ubicacion !== null && (
        <>
          <span aria-hidden="true">›</span>
          <button type="button" onClick={navegacion.alIrAlTeam}>
            {ubicacion.teamNombre}
          </button>
        </>
      )}
      <span aria-hidden="true">›</span>
      <span aria-current="page">Slot {slot}</span>
    </nav>
  )
}
