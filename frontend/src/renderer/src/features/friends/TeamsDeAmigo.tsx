import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { DuenioDeTeams, ErrorDeAmigos } from '../../../../shared/amigos'
import type { GrupoDeAmigo, TeamDeAmigo } from '../../../../shared/teams'
import SeccionDeGrupo from '../teams/SeccionDeGrupo'
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
  | {
      readonly tipo: 'listo'
      readonly teams: readonly TeamDeAmigo[]
      readonly grupos: readonly GrupoDeAmigo[]
    }

function teamsDelGrupo(grupo: GrupoDeAmigo, teams: readonly TeamDeAmigo[]): TeamDeAmigo[] {
  const delGrupo = grupo.teamIds.flatMap((id) => teams.find((team) => team.id === id) ?? [])
  const portada = delGrupo.filter((team) => team.id === grupo.portadaTeamId)
  return [...portada, ...delGrupo.filter((team) => team.id !== grupo.portadaTeamId)]
}

export default function TeamsDeAmigo({
  amigo,
  alAbrirSlot,
  alVolver,
  alSinAcceso,
  alSesionVencida
}: TeamsDeAmigoProps): ReactElement {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [intento, setIntento] = useState(0)
  const avisos = useRef({ alSinAcceso, alSesionVencida })
  avisos.current = { alSinAcceso, alSesionVencida }

  useEffect(() => {
    let activo = true
    void window.aniimo.amigos.listarTeams({ usuarioId: amigo.id }).then((resultado) => {
      if (!activo) {
        return
      }
      if (resultado.ok) {
        setEstado({ tipo: 'listo', teams: resultado.teams, grupos: resultado.grupos })
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
  }, [amigo.id, intento])

  function reintentar(): void {
    setEstado({ tipo: 'cargando' })
    setIntento((actual) => actual + 1)
  }

  const cargarImagen: CargarImagenDeTarjeta = useCallback(
    (teamId, slot) => window.aniimo.amigos.obtenerImagen({ usuarioId: amigo.id, teamId, slot }),
    [amigo.id]
  )

  const sueltos =
    estado.tipo === 'listo'
      ? estado.teams.filter((team) => team.grupoId === null).sort((a, b) => a.orden - b.orden)
      : []

  function tarjetaDe(team: TeamDeAmigo): ReactElement {
    return (
      <section className="tarjeta-team" key={team.id} aria-labelledby={`team-${team.id}`}>
        <header className="tarjeta-team__encabezado">
          <h4 className="tarjeta-team__nombre" id={`team-${team.id}`}>
            {team.nombre}
          </h4>
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
              esPortada={slot.slot === team.portadaSlot}
              cargarImagen={cargarImagen}
              alAbrir={(numero) => alAbrirSlot(team.id, numero, team.nombre)}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="principal__seccion">
      <h2 className="principal__subtitulo" tabIndex={-1}>Teams de {amigo.nombreUsuario}</h2>
      <div>
        <button type="button" onClick={alVolver}>
          Volver a Amigos
        </button>
      </div>
      {estado.tipo === 'cargando' && <p className="lista-de-teams__estado">Cargando teams…</p>}
      {estado.tipo === 'error' && (
        <div className="lista-de-teams__estado">
          <p role="alert">{mensajeDeErrorDeAmigos(estado.error)}</p>
          <button type="button" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}
      {estado.tipo === 'listo' && estado.teams.length === 0 && (
        <p className="lista-de-teams__estado">
          {amigo.nombreUsuario} todavía no tiene teams para mostrar
        </p>
      )}
      {estado.tipo === 'listo' && (
        <div className="lista-de-teams">
          {[...estado.grupos]
            .sort((a, b) => a.orden - b.orden)
            .map((grupo) => {
              const delGrupo = teamsDelGrupo(grupo, estado.teams)
              return (
                <SeccionDeGrupo
                  key={grupo.id}
                  id={grupo.id}
                  nombre={grupo.nombre}
                  cantidad={`${delGrupo.length} teams`}
                >
                  {delGrupo.map(tarjetaDe)}
                </SeccionDeGrupo>
              )
            })}
          {sueltos.length > 0 && (
            <SeccionDeGrupo id="sin-grupo" nombre="Sin grupo">
              {sueltos.map(tarjetaDe)}
            </SeccionDeGrupo>
          )}
        </div>
      )}
    </section>
  )
}
