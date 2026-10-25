import type { ReactElement } from 'react'
import FichaDeSoloLectura from '../aniimo/FichaDeSoloLectura'
import TeamCompacto from './TeamCompacto'
import { useOverlay } from './useOverlay'
import '../../shared/styles/tokens.css'
import '../teams/teams.css'
import './overlay.css'

const MENSAJE_SIN_SELECCION = 'Elegí un team desde «Mis teams» con «Abrir en overlay»'
const MENSAJE_NO_EXISTE = 'Ese team ya no existe'
const MENSAJE_FALLO = 'No se pudieron cargar los datos'

export default function OverlayApp(): ReactElement {
  const { datos, ficha, fallo, actualizar, abrirSlot, volverAlTeam, cerrar } = useOverlay()

  return (
    <main className="overlay">
      <header className="overlay__barra">
        <h1 className="overlay__titulo">{datos.tipo === 'team' ? datos.team.nombre : 'Overlay'}</h1>
        <div className="overlay__acciones">
          <button type="button" onClick={() => void actualizar()}>
            Actualizar
          </button>
          <button type="button" onClick={cerrar}>
            Cerrar overlay
          </button>
        </div>
      </header>
      <div className="overlay__contenido">
        {fallo && (
          <p className="overlay__aviso" role="alert">
            {MENSAJE_FALLO}
          </p>
        )}
        {datos.tipo === 'cargando' && (
          <p className="overlay__estado" role="status">
            Cargando…
          </p>
        )}
        {datos.tipo === 'sin-seleccion' && (
          <p className="overlay__estado">{MENSAJE_SIN_SELECCION}</p>
        )}
        {datos.tipo === 'no-existe' && <p className="overlay__estado">{MENSAJE_NO_EXISTE}</p>}
        {datos.tipo === 'team' && ficha === null && (
          <TeamCompacto team={datos.team} alAbrirSlot={(slot) => void abrirSlot(slot)} />
        )}
        {datos.tipo === 'team' && ficha !== null && (
          <div className="overlay__ficha">
            <button type="button" onClick={volverAlTeam}>
              Volver al team
            </button>
            <FichaDeSoloLectura ficha={ficha.ficha} imagen={ficha.imagen} />
          </div>
        )}
      </div>
    </main>
  )
}
