import type { ReactElement, ReactNode } from 'react'
import type { TeamResumen } from '../../../../shared/teams'
import type { CargarImagenDeTarjeta } from '../teams/useImagenDeTarjeta'
import { posicionesDelAbanico } from './abanico'
import PilaDeTeam from './PilaDeTeam'
import './mazo.css'

interface GrupoEnAbanicoProps {
  readonly grupoId: string
  readonly nombre: string
  readonly teams: readonly TeamResumen[]
  readonly portadaTeamId: string | null
  readonly abierto: boolean
  readonly alAlternar: () => void
  readonly alEntrar: () => void
  readonly alSalir: () => void
  readonly alAbrirTeam: (teamId: string) => void
  readonly teamDesplegado?: string | null
  readonly alEntrarTeam?: (teamId: string) => void
  readonly alSalirTeam?: (teamId: string) => void
  readonly cargarImagen?: CargarImagenDeTarjeta
  readonly children?: ReactNode
}

export function idDelBotonDeGrupo(grupoId: string): string {
  return `boton-grupo-${grupoId}`
}

export default function GrupoEnAbanico({
  grupoId,
  nombre,
  teams,
  portadaTeamId,
  abierto,
  alAlternar,
  alEntrar,
  alSalir,
  alAbrirTeam,
  teamDesplegado = null,
  alEntrarTeam,
  alSalirTeam,
  cargarImagen,
  children
}: GrupoEnAbanicoProps): ReactElement {
  const desplegado = abierto && teams.length > 1
  const conCartas = desplegado || teams.length <= 1
  const posiciones = posicionesDelAbanico(
    teams.map((team) => team.id),
    portadaTeamId,
    desplegado
  )
  const portada = teams.find((team) => team.id === (portadaTeamId ?? teams[0]?.id))
  const cuenta = teams.length === 1 ? '1 team' : `${teams.length} teams`
  const claseDelAbanico = [
    'abanico',
    `abanico--n${Math.min(teams.length, 5)}`,
    desplegado ? 'abanico--abierto' : ''
  ]
    .filter((clase) => clase !== '')
    .join(' ')

  return (
    <section
      className={desplegado ? 'grupo grupo--abierto' : 'grupo'}
      aria-label={`Grupo ${nombre}`}
      data-grupo-id={grupoId}
      onPointerEnter={alEntrar}
      onPointerLeave={alSalir}
    >
      <div className={claseDelAbanico}>
        {teams.map((team, indice) => {
          const posicion = posiciones[indice]!
          return (
            <PilaDeTeam
              key={team.id}
              teamId={team.id}
              nombre={team.nombre}
              slots={team.slots}
              portadaSlot={team.portadaEfectivaSlot}
              ocultoParaAmigos={team.ocultoParaAmigos}
              alAbrir={() => alAbrirTeam(team.id)}
              desplegada={conCartas && teamDesplegado === team.id}
              {...(conCartas && alEntrarTeam !== undefined
                ? { alEntrar: () => alEntrarTeam(team.id) }
                : {})}
              {...(alSalirTeam === undefined ? {} : { alSalir: () => alSalirTeam(team.id) })}
              clase={`abanico__team abanico__team--${posicion.posicion}`}
              oculta={!posicion.enfocable}
              {...(desplegado ? { numero: posicion.numero } : {})}
              {...(cargarImagen === undefined ? {} : { cargarImagen })}
            />
          )
        })}
      </div>
      <button
        id={idDelBotonDeGrupo(grupoId)}
        type="button"
        className="grupo__boton"
        aria-expanded={desplegado}
        onClick={alAlternar}
      >
        <strong className="grupo__nombre">{nombre}</strong>{' '}
        <span className="grupo__detalle">
          {cuenta} · portada «{portada?.nombre ?? ''}»
        </span>
      </button>
      {children}
    </section>
  )
}
