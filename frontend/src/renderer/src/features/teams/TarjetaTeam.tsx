import { useState, type FormEvent, type ReactElement } from 'react'
import type { ErrorDeTeams, TeamResumen } from '../../../../shared/teams'
import Confirmacion from '../../shared/components/Confirmacion'
import { MENSAJE_NOMBRE_DE_TEAM_INVALIDO, mensajeDeErrorDeTeams } from './mensajes'
import TarjetaAniimo from './TarjetaAniimo'

interface TarjetaTeamProps {
  readonly team: TeamResumen
  readonly deshabilitado: boolean
  readonly alRenombrar: (nombre: string) => Promise<ErrorDeTeams | null>
  readonly alBorrar: () => Promise<ErrorDeTeams | null>
  readonly alAbrirSlot: (teamId: string, slot: number) => void
}

export default function TarjetaTeam({
  team,
  deshabilitado,
  alRenombrar,
  alBorrar,
  alAbrirSlot
}: TarjetaTeamProps): ReactElement {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(team.nombre)
  const [confirmando, setConfirmando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  function empezarEdicion(): void {
    setNombre(team.nombre)
    setMensaje(null)
    setEditando(true)
  }

  async function guardarNombre(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const error = await alRenombrar(nombre)
    if (error === null) {
      setEditando(false)
      setMensaje(null)
    } else {
      setMensaje(
        error.error === 'datos-invalidos'
          ? MENSAJE_NOMBRE_DE_TEAM_INVALIDO
          : mensajeDeErrorDeTeams(error)
      )
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
    <section className="tarjeta-team" aria-labelledby={`team-${team.id}`}>
      <header className="tarjeta-team__encabezado">
        <h3 className="tarjeta-team__nombre" id={`team-${team.id}`}>
          {team.nombre}
        </h3>
        <div className="tarjeta-team__acciones">
          <button type="button" disabled={deshabilitado} onClick={empezarEdicion}>
            Renombrar
          </button>
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => {
              setMensaje(null)
              setConfirmando(true)
            }}
          >
            Borrar team
          </button>
        </div>
      </header>
      {editando && (
        <form className="tarjeta-team__renombrar" onSubmit={(e) => void guardarNombre(e)}>
          <label>
            Nuevo nombre
            <input
              type="text"
              value={nombre}
              disabled={deshabilitado}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <button type="submit" disabled={deshabilitado}>
            Guardar nombre
          </button>
          <button type="button" disabled={deshabilitado} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      )}
      {confirmando && (
        <Confirmacion
          mensaje={`¿Borrar el team «${team.nombre}» y todos sus Aniimo?`}
          deshabilitado={deshabilitado}
          alConfirmar={() => void borrar()}
          alCancelar={() => setConfirmando(false)}
        />
      )}
      {mensaje !== null && (
        <p className="tarjeta-team__mensaje" role="alert">
          {mensaje}
        </p>
      )}
      <div className="tarjeta-team__slots">
        {team.slots.map((slot) => (
          <TarjetaAniimo
            key={slot.slot}
            teamId={team.id}
            slot={slot.slot}
            aniimo={slot.aniimo}
            deshabilitado={deshabilitado}
            alAbrir={(numero) => alAbrirSlot(team.id, numero)}
          />
        ))}
      </div>
    </section>
  )
}
