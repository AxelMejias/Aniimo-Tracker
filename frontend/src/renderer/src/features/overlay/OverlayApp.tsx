import type { ReactElement } from 'react'
import FichaDeSoloLectura from '../aniimo/FichaDeSoloLectura'
import SelectorDeTeam from './SelectorDeTeam'
import TeamCompacto from './TeamCompacto'
import { useOverlay } from './useOverlay'
import '../../shared/styles/tokens.css'
import '../../shared/styles/base.css'
import './overlay.css'

const MENSAJE_SIN_SELECCION = 'Elegí un team desde «Mis teams» con «Abrir en overlay»'
const MENSAJE_NO_EXISTE = 'Ese team ya no existe'
const MENSAJE_FALLO = 'No se pudieron cargar los datos'

export default function OverlayApp(): ReactElement {
  const { datos, opciones, ficha, fallo, actualizar, seleccionar, abrirSlot, volverAlTeam, cerrar } =
    useOverlay()

  return (
    <main className="overlay">
      <header className="overlay__barra">
        <div className="overlay__arrastre">
          <h1 className="overlay__titulo">{datos.tipo === 'team' ? datos.team.nombre : 'Overlay'}</h1>
          <div className="overlay__acciones">
            <button type="button" className="overlay__actualizar" onClick={() => void actualizar()}>
              Actualizar
            </button>
            <button
              type="button"
              className="overlay__cerrar"
              aria-label="Cerrar overlay"
              onClick={cerrar}
            >
              Cerrar
            </button>
          </div>
        </div>
        {opciones !== null && (
          <SelectorDeTeam
            opciones={opciones}
            teamId={datos.tipo === 'team' ? datos.team.id : null}
            alElegir={(teamId) => void seleccionar(teamId)}
          />
        )}
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
