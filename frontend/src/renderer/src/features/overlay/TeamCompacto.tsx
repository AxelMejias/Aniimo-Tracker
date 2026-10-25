import type { ReactElement } from 'react'
import type { TeamResumen } from '../../../../shared/teams'
import TarjetaAniimo from '../teams/TarjetaAniimo'

interface TeamCompactoProps {
  readonly team: TeamResumen
  readonly alAbrirSlot: (slot: number) => void
}

export default function TeamCompacto({ team, alAbrirSlot }: TeamCompactoProps): ReactElement {
  return (
    <div className="overlay__slots">
      {team.slots.map((slot) => (
        <TarjetaAniimo
          key={slot.slot}
          teamId={team.id}
          slot={slot.slot}
          aniimo={slot.aniimo}
          deshabilitado={false}
          alAbrir={alAbrirSlot}
          soloLectura
        />
      ))}
    </div>
  )
}
