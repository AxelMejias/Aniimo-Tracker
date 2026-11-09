import { useState, type FormEvent, type ReactElement } from 'react'
import { LARGO_MAXIMO_NOMBRE_CORTO, type ErrorDeTeams } from '../../../../shared/teams'
import { mensajeDeErrorDeNombreDeGrupo, mensajeDeErrorDeTeams } from './mensajes'
import type { SeccionDeGrupoDatos } from './secciones'

interface ControlesDeGrupoProps {
  readonly seccion: SeccionDeGrupoDatos
  readonly deshabilitado: boolean
  readonly alRenombrar: (nombre: string) => Promise<ErrorDeTeams | null>
  readonly alElegirPortada: (teamId: string | null) => Promise<ErrorDeTeams | null>
}

export default function ControlesDeGrupo({
  seccion,
  deshabilitado,
  alRenombrar,
  alElegirPortada
}: ControlesDeGrupoProps): ReactElement {
  const { grupo, teams } = seccion
  const [eligiendoPortada, setEligiendoPortada] = useState(false)
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(grupo.nombre)
  const [mensaje, setMensaje] = useState<string | null>(null)

  function empezarEdicion(): void {
    setNombre(grupo.nombre)
    setMensaje(null)
    setEditando(true)
  }

  async function guardarNombre(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const error = await alRenombrar(nombre.trim())
    if (error === null) {
      setEditando(false)
      setMensaje(null)
    } else {
      setMensaje(mensajeDeErrorDeNombreDeGrupo(error))
    }
  }

  async function elegirPortada(valor: string): Promise<void> {
    setMensaje(null)
    const error = await alElegirPortada(valor === '' ? null : valor)
    if (error !== null) {
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  return (
    <div className="controles-de-grupo">
      <div className="controles-de-grupo__botones">
        <button
          type="button"
          aria-expanded={eligiendoPortada}
          disabled={deshabilitado || teams.length === 0}
          onClick={() => setEligiendoPortada((actual) => !actual)}
        >
          Elegir portada
        </button>
        <button type="button" disabled={deshabilitado} onClick={empezarEdicion}>
          Renombrar
        </button>
      </div>
      {eligiendoPortada && (
        <label className="controles-de-grupo__portada">
          Portada del grupo
          <select
            value={grupo.portadaTeamId ?? ''}
            disabled={deshabilitado}
            onChange={(e) => void elegirPortada(e.target.value)}
          >
            <option value="">Automática</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {editando && (
        <form className="controles-de-grupo__renombrar" onSubmit={(e) => void guardarNombre(e)}>
          <label>
            Nuevo nombre del grupo
            <input
              type="text"
              value={nombre}
              maxLength={LARGO_MAXIMO_NOMBRE_CORTO}
              disabled={deshabilitado}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <button type="submit" disabled={deshabilitado || nombre.trim() === ''}>
            Guardar nombre del grupo
          </button>
          <button type="button" disabled={deshabilitado} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      )}
      {mensaje !== null && (
        <p className="controles-de-grupo__mensaje" role="alert">
          {mensaje}
        </p>
      )}
    </div>
  )
}
