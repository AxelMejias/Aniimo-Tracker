import type { ReactElement } from 'react'
import ListaDeTeams from '../features/teams/ListaDeTeams'

interface MisTeamsPageProps {
  readonly alAbrirSlot: (teamId: string, slot: number) => void
  readonly alSesionVencida: () => void
}

export default function MisTeamsPage({
  alAbrirSlot,
  alSesionVencida
}: MisTeamsPageProps): ReactElement {
  return (
    <section className="principal__seccion">
      <h2 className="principal__subtitulo">Mis teams</h2>
      <ListaDeTeams alAbrirSlot={alAbrirSlot} alSesionVencida={alSesionVencida} />
    </section>
  )
}
