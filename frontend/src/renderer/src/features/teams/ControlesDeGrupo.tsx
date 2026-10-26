import { useState, type FormEvent, type ReactElement } from 'react'
import { LARGO_MAXIMO_NOMBRE_CORTO, type ErrorDeTeams } from '../../../../shared/teams'
import Confirmacion from '../../shared/components/Confirmacion'
import ControlesDeOrden from './ControlesDeOrden'
import type { Direccion } from './destinoDeArrastre'
import { mensajeDeErrorDeNombreDeGrupo, mensajeDeErrorDeTeams } from './mensajes'
import type { SeccionDeGrupoDatos } from './secciones'

interface ControlesDeGrupoProps {
  readonly seccion: SeccionDeGrupoDatos
  readonly deshabilitado: boolean
  readonly puedeSubir: boolean
  readonly puedeBajar: boolean
  readonly alRenombrar: (nombre: string) => Promise<ErrorDeTeams | null>
  readonly alElegirPortada: (teamId: string | null) => Promise<ErrorDeTeams | null>
  readonly alBorrar: () => Promise<ErrorDeTeams | null>
  readonly alMover: (direccion: Direccion) => void
}

export default function ControlesDeGrupo({
  seccion,
  deshabilitado,
  puedeSubir,
  puedeBajar,
  alRenombrar,
  alElegirPortada,
  alBorrar,
  alMover
}: ControlesDeGrupoProps): ReactElement {
  const { grupo, teams } = seccion
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(grupo.nombre)
  const [confirmando, setConfirmando] = useState(false)
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

  async function borrar(): Promise<void> {
    const error = await alBorrar()
    if (error !== null) {
      setConfirmando(false)
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  return (
    <>
      <div className="controles-de-grupo">
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
        <button
          type="button"
          aria-label={`Renombrar grupo ${grupo.nombre}`}
          disabled={deshabilitado}
          onClick={empezarEdicion}
        >
          Renombrar
        </button>
        <button
          type="button"
          aria-label={`Borrar grupo ${grupo.nombre}`}
          disabled={deshabilitado}
          onClick={() => {
            setMensaje(null)
            setConfirmando(true)
          }}
        >
          Borrar grupo
        </button>
        <ControlesDeOrden
          tipo="grupo"
          id={grupo.id}
          nombre={grupo.nombre}
          puedeSubir={puedeSubir}
          puedeBajar={puedeBajar}
          deshabilitado={deshabilitado}
          alMover={alMover}
        />
      </div>
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
      {confirmando && (
        <Confirmacion
          mensaje={`¿Borrar el grupo «${grupo.nombre}»? Los teams quedan sin grupo.`}
          deshabilitado={deshabilitado}
          alConfirmar={() => void borrar()}
          alCancelar={() => setConfirmando(false)}
        />
      )}
      {mensaje !== null && (
        <p className="seccion-de-grupo__mensaje" role="alert">
          {mensaje}
        </p>
      )}
    </>
  )
}
