import { useState, type FormEvent, type ReactElement } from 'react'
import type { ErrorDeOverlay } from '../../../../shared/overlay'
import type { TeamResumen } from '../../../../shared/teams'
import { mensajeDeErrorDeNombreDeTeam, mensajeDeErrorDeTeams } from './mensajes'
import TarjetaTeam from './TarjetaTeam'
import { useTeams } from './useTeams'
import './teams.css'

const MAXIMO_DE_TEAMS = 4
const TEXTO_SIN_TEAMS = `Todavía no tenés teams. Creá el primero (podés tener hasta ${MAXIMO_DE_TEAMS}).`
const TEXTO_MAXIMO_DE_TEAMS = `Llegaste al máximo de ${MAXIMO_DE_TEAMS} teams.`

interface ListaDeTeamsProps {
  readonly alAbrirSlot: (teamId: string, slot: number) => void
  readonly alSesionVencida: () => void
}

function nombrePropuesto(teams: readonly TeamResumen[]): string {
  const ocupadas = new Set(teams.map((team) => team.orden))
  for (let orden = 1; orden <= MAXIMO_DE_TEAMS; orden += 1) {
    if (!ocupadas.has(orden)) {
      return `Team ${orden}`
    }
  }
  return `Team ${MAXIMO_DE_TEAMS}`
}

export default function ListaDeTeams({
  alAbrirSlot,
  alSesionVencida
}: ListaDeTeamsProps): ReactElement {
  const { estado, pendiente, recargar, crear, renombrar, cambiarVisibilidad, borrar } =
    useTeams(alSesionVencida)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function abrirEnOverlay(teamId: string): Promise<ErrorDeOverlay | null> {
    const resultado = await window.aniimo.overlay.abrir({ teamId })
    if (resultado.ok) {
      return null
    }
    if (resultado.error === 'sesion-vencida') {
      alSesionVencida()
    }
    return resultado
  }

  if (estado.tipo === 'cargando') {
    return <p className="lista-de-teams__estado">Cargando teams…</p>
  }
  if (estado.tipo === 'error') {
    return (
      <div className="lista-de-teams__estado">
        <p role="alert">{mensajeDeErrorDeTeams(estado.error)}</p>
        <button type="button" onClick={() => void recargar()}>
          Reintentar
        </button>
      </div>
    )
  }

  const { teams } = estado

  function abrirFormulario(): void {
    setNombre(nombrePropuesto(teams))
    setMensaje(null)
    setCreando(true)
  }

  async function confirmarCreacion(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const error = await crear(nombre)
    if (error === null) {
      setCreando(false)
      setMensaje(null)
    } else {
      setMensaje(mensajeDeErrorDeNombreDeTeam(error))
    }
  }

  return (
    <div className="lista-de-teams">
      {teams.length === 0 && <p className="lista-de-teams__estado">{TEXTO_SIN_TEAMS}</p>}
      {teams.length >= MAXIMO_DE_TEAMS && (
        <p className="lista-de-teams__estado">{TEXTO_MAXIMO_DE_TEAMS}</p>
      )}
      {teams.map((team) => (
        <TarjetaTeam
          key={team.id}
          team={team}
          deshabilitado={pendiente}
          alRenombrar={(nuevo) => renombrar(team.id, nuevo)}
          alCambiarVisibilidad={(oculto) => cambiarVisibilidad(team.id, oculto)}
          alBorrar={() => borrar(team.id)}
          alAbrirSlot={alAbrirSlot}
          alAbrirEnOverlay={() => abrirEnOverlay(team.id)}
        />
      ))}
      {teams.length < MAXIMO_DE_TEAMS &&
        (creando ? (
          <form className="lista-de-teams__crear" onSubmit={(e) => void confirmarCreacion(e)}>
            <label>
              Nombre del team
              <input
                type="text"
                value={nombre}
                disabled={pendiente}
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>
            <button type="submit" disabled={pendiente}>
              Crear
            </button>
            <button type="button" disabled={pendiente} onClick={() => setCreando(false)}>
              Cancelar
            </button>
            {mensaje !== null && (
              <p className="lista-de-teams__mensaje" role="alert">
                {mensaje}
              </p>
            )}
          </form>
        ) : (
          <button
            className="lista-de-teams__nuevo"
            type="button"
            disabled={pendiente}
            onClick={abrirFormulario}
          >
            Crear team
          </button>
        ))}
    </div>
  )
}
