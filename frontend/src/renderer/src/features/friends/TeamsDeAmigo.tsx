import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { DuenioDeTeams, ErrorDeAmigos } from '../../../../shared/amigos'
import type { TeamDeAmigo } from '../../../../shared/teams'
import TarjetaAniimo from '../teams/TarjetaAniimo'
import type { CargarImagenDeTarjeta } from '../teams/useImagenDeTarjeta'
import '../teams/teams.css'
import { mensajeDeErrorDeAmigos } from './mensajes'

interface TeamsDeAmigoProps {
  readonly amigo: DuenioDeTeams
  readonly alAbrirSlot: (teamId: string, slot: number, nombreDelTeam: string) => void
  readonly alVolver: () => void
  readonly alSinAcceso: () => void
  readonly alSesionVencida: () => void
}

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly error: ErrorDeAmigos }
  | { readonly tipo: 'listo'; readonly teams: readonly TeamDeAmigo[] }

export default function TeamsDeAmigo({
  amigo,
  alAbrirSlot,
  alVolver,
  alSinAcceso,
  alSesionVencida
}: TeamsDeAmigoProps): ReactElement {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const avisos = useRef({ alSinAcceso, alSesionVencida })
  avisos.current = { alSinAcceso, alSesionVencida }

  useEffect(() => {
    let activo = true
    void window.aniimo.amigos.listarTeams({ usuarioId: amigo.id }).then((resultado) => {
      if (!activo) {
        return
      }
      if (resultado.ok) {
        setEstado({ tipo: 'listo', teams: resultado.teams })
      } else if (resultado.error === 'sesion-vencida') {
        avisos.current.alSesionVencida()
      } else if (resultado.error === 'no-encontrado') {
        avisos.current.alSinAcceso()
      } else {
        setEstado({ tipo: 'error', error: resultado })
      }
    })
    return () => {
      activo = false
    }
  }, [amigo.id])

  const cargarImagen: CargarImagenDeTarjeta = useCallback(
    (teamId, slot) => window.aniimo.amigos.obtenerImagen({ usuarioId: amigo.id, teamId, slot }),
    [amigo.id]
  )

  return (
    <section className="principal__seccion">
      <h2 className="principal__subtitulo">Teams de {amigo.nombreUsuario}</h2>
      <div>
        <button type="button" onClick={alVolver}>
          Volver a Amigos
        </button>
      </div>
      {estado.tipo === 'cargando' && <p className="lista-de-teams__estado">Cargando teams…</p>}
      {estado.tipo === 'error' && <p role="alert">{mensajeDeErrorDeAmigos(estado.error)}</p>}
      {estado.tipo === 'listo' && estado.teams.length === 0 && (
        <p className="lista-de-teams__estado">
          {amigo.nombreUsuario} todavía no tiene teams para mostrar
        </p>
      )}
      {estado.tipo === 'listo' && (
        <div className="lista-de-teams">
          {estado.teams.map((team) => (
            <section className="tarjeta-team" key={team.id} aria-labelledby={`team-${team.id}`}>
              <header className="tarjeta-team__encabezado">
                <h3 className="tarjeta-team__nombre" id={`team-${team.id}`}>
                  {team.nombre}
                </h3>
              </header>
              <div className="tarjeta-team__slots">
                {team.slots.map((slot) => (
                  <TarjetaAniimo
                    key={slot.slot}
                    teamId={team.id}
                    slot={slot.slot}
                    aniimo={slot.aniimo}
                    deshabilitado={false}
                    soloLectura
                    cargarImagen={cargarImagen}
                    alAbrir={(numero) => alAbrirSlot(team.id, numero, team.nombre)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
