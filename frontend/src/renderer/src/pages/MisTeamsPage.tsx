import { useState, type ReactElement } from 'react'
import FichaAniimo from '../features/aniimo/FichaAniimo'
import type { Recodificador } from '../features/aniimo/recodificarImagen'
import ListaDeTeams from '../features/teams/ListaDeTeams'
import './MisTeamsPage.css'

interface MisTeamsPageProps {
  readonly nombreUsuario: string
  readonly alCerrarSesion: () => void
  readonly alSesionVencida: () => void
  readonly recodificar?: Recodificador
}

type Vista =
  | { readonly tipo: 'teams' }
  | { readonly tipo: 'ficha'; readonly teamId: string; readonly slot: number }

export default function MisTeamsPage({
  nombreUsuario,
  alCerrarSesion,
  alSesionVencida,
  recodificar
}: MisTeamsPageProps): ReactElement {
  const [vista, setVista] = useState<Vista>({ tipo: 'teams' })

  return (
    <main className="mis-teams-page">
      <header className="mis-teams-page__encabezado">
        <h1 className="mis-teams-page__titulo">Aniimo Team Tracker</h1>
        <p className="mis-teams-page__usuario">
          Sesión iniciada como <span className="mis-teams-page__nombre">{nombreUsuario}</span>
        </p>
        <button type="button" onClick={alCerrarSesion}>
          Cerrar sesión
        </button>
      </header>
      {vista.tipo === 'teams' ? (
        <>
          <h2 className="mis-teams-page__subtitulo">Mis teams</h2>
          <ListaDeTeams
            alAbrirSlot={(teamId, slot) => setVista({ tipo: 'ficha', teamId, slot })}
            alSesionVencida={alSesionVencida}
          />
        </>
      ) : (
        <FichaAniimo
          teamId={vista.teamId}
          slot={vista.slot}
          alVolver={() => setVista({ tipo: 'teams' })}
          alSesionVencida={alSesionVencida}
          {...(recodificar === undefined ? {} : { recodificar })}
        />
      )}
    </main>
  )
}
