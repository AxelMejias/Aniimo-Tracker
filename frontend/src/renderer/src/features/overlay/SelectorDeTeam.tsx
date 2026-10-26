import type { ReactElement } from 'react'
import { armarSecciones } from '../teams/secciones'
import type { OpcionesDelOverlay } from './useOverlay'

interface SelectorDeTeamProps {
  readonly opciones: OpcionesDelOverlay
  readonly teamId: string | null
  readonly alElegir: (teamId: string) => void
}

export default function SelectorDeTeam({
  opciones,
  teamId,
  alElegir
}: SelectorDeTeamProps): ReactElement {
  const { grupos, sueltos } = armarSecciones(opciones.teams, opciones.grupos)
  return (
    <label className="overlay__selector">
      Team
      <select value={teamId ?? ''} onChange={(e) => alElegir(e.target.value)}>
        {teamId === null && (
          <option value="" disabled>
            Elegí un team
          </option>
        )}
        {grupos.map(({ grupo, teams }) => (
          <optgroup key={grupo.id} label={grupo.nombre}>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.nombre}
              </option>
            ))}
          </optgroup>
        ))}
        {sueltos.length > 0 && (
          <optgroup label="Sin grupo">
            {sueltos.map((team) => (
              <option key={team.id} value={team.id}>
                {team.nombre}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}
