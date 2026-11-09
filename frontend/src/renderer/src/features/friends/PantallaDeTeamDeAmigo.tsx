import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { DuenioDeTeams, ErrorDeAmigos } from '../../../../shared/amigos'
import type { GrupoDeAmigo, TeamDeAmigo } from '../../../../shared/teams'
import CartaAniimo from '../mazo/CartaAniimo'
import type { CargarImagenDeTarjeta } from '../teams/useImagenDeTarjeta'
import '../teams/pantallaDeTeam.css'
import { mensajeDeErrorDeAmigos } from './mensajes'

interface PantallaDeTeamDeAmigoProps {
  readonly amigo: DuenioDeTeams
  readonly teamId: string
  readonly alAbrirSlot: (teamId: string, slot: number) => void
  readonly alIrAAmigos: () => void
  readonly alIrATeams: (grupoId?: string) => void
  readonly alSinAcceso: () => void
  readonly alSesionVencida: () => void
}

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly error: ErrorDeAmigos }
  | { readonly tipo: 'listo'; readonly team: TeamDeAmigo; readonly grupo: GrupoDeAmigo | null }

export default function PantallaDeTeamDeAmigo({
  amigo,
  teamId,
  alAbrirSlot,
  alIrAAmigos,
  alIrATeams,
  alSinAcceso,
  alSesionVencida
}: PantallaDeTeamDeAmigoProps): ReactElement {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const titulo = useRef<HTMLHeadingElement>(null)
  const avisos = useRef({ alSinAcceso, alSesionVencida })
  avisos.current = { alSinAcceso, alSesionVencida }

  useEffect(() => {
    let activo = true
    void window.aniimo.amigos.listarTeams({ usuarioId: amigo.id }).then((resultado) => {
      if (!activo) {
        return
      }
      if (!resultado.ok) {
        if (resultado.error === 'sesion-vencida') {
          avisos.current.alSesionVencida()
        } else if (resultado.error === 'no-encontrado') {
          avisos.current.alSinAcceso()
        } else {
          setEstado({ tipo: 'error', error: resultado })
        }
        return
      }
      const team = resultado.teams.find((candidato) => candidato.id === teamId)
      if (team === undefined) {
        avisos.current.alSinAcceso()
        return
      }
      const grupo = resultado.grupos.find((candidato) => candidato.id === team.grupoId) ?? null
      setEstado({ tipo: 'listo', team, grupo })
    })
    return () => {
      activo = false
    }
  }, [amigo.id, teamId])

  const cargado = estado.tipo === 'listo'
  useEffect(() => {
    if (cargado) {
      titulo.current?.focus()
    }
  }, [cargado])

  const cargarImagen: CargarImagenDeTarjeta = useCallback(
    (id, slot) => window.aniimo.amigos.obtenerImagen({ usuarioId: amigo.id, teamId: id, slot }),
    [amigo.id]
  )

  if (estado.tipo === 'cargando') {
    return <p className="lista-de-teams__estado">Cargando teams…</p>
  }
  if (estado.tipo === 'error') {
    return (
      <div className="lista-de-teams__estado">
        <p role="alert">{mensajeDeErrorDeAmigos(estado.error)}</p>
        <button type="button" onClick={() => alIrATeams()}>
          Volver a los teams
        </button>
      </div>
    )
  }

  const { team, grupo } = estado
  const ocupados = team.slots.filter((slot) => slot.aniimo !== null).length

  return (
    <section className="pantalla-de-team">
      <p className="amigos__rotulo">Solo lectura</p>
      <nav className="pantalla-de-team__migas" aria-label="Ubicación">
        <button type="button" onClick={alIrAAmigos}>
          Amigos
        </button>
        <span aria-hidden="true">›</span>
        <button type="button" onClick={() => alIrATeams()}>
          {amigo.nombreUsuario}
        </button>
        {grupo !== null && (
          <>
            <span aria-hidden="true">›</span>
            <button type="button" onClick={() => alIrATeams(grupo.id)}>
              {grupo.nombre}
            </button>
          </>
        )}
        <span aria-hidden="true">›</span>
        <span aria-current="page">{team.nombre}</span>
      </nav>
      <h2 className="principal__subtitulo" tabIndex={-1} ref={titulo}>
        {team.nombre}
      </h2>
      <p className="pantalla-de-team__datos">
        <span>{ocupados}/4 Aniimo</span>
      </p>
      <div className="pantalla-de-team__cartas">
        {team.slots.map(({ slot, aniimo }) =>
          aniimo === null ? (
            <div key={slot} className="pantalla-de-team__vacio pantalla-de-team__vacio--fijo">
              Vacío
            </div>
          ) : (
            <button
              key={slot}
              type="button"
              className="pantalla-de-team__carta"
              onClick={() => alAbrirSlot(team.id, slot)}
            >
              <CartaAniimo
                teamId={team.id}
                slot={slot}
                aniimo={aniimo}
                variante="team"
                esPortada={slot === team.portadaSlot}
                cargarImagen={cargarImagen}
              />
            </button>
          )
        )}
      </div>
    </section>
  )
}
