import type { ReactElement } from 'react'
import ListaDeTeams from '../features/teams/ListaDeTeams'

interface MisTeamsPageProps {
  readonly grupoDesplegado?: string | null
  readonly alAbrirTeam: (teamId: string) => void
  readonly alSesionVencida: () => void
}

export default function MisTeamsPage({
  grupoDesplegado = null,
  alAbrirTeam,
  alSesionVencida
}: MisTeamsPageProps): ReactElement {
  return (
    <section className="principal__seccion">
      <h2 className="principal__subtitulo" tabIndex={-1}>Mis teams</h2>
      <ListaDeTeams
        grupoDesplegado={grupoDesplegado}
        alAbrirTeam={alAbrirTeam}
        alSesionVencida={alSesionVencida}
      />
    </section>
  )
}
