import { useState, type HTMLAttributes, type ReactElement } from 'react'
import type { ErrorDeTeams, TeamResumen } from '../../../../shared/teams'
import ControlesDeOrden from './ControlesDeOrden'
import type { Direccion } from './destinoDeArrastre'
import { mensajeDeErrorDeTeams } from './mensajes'
import type { OpcionDeGrupo } from './secciones'
import SelectorDeGrupo from './SelectorDeGrupo'

interface FilaDeTeamProps {
  readonly team: TeamResumen
  readonly deshabilitado: boolean
  readonly opcionesDeGrupo: readonly OpcionDeGrupo[]
  readonly alCambiarGrupo: (grupoId: string | null) => Promise<ErrorDeTeams | null>
  readonly puedeSubir: boolean
  readonly puedeBajar: boolean
  readonly alMover: (direccion: Direccion) => void
  readonly esDestino: boolean
  readonly propsDeLaFila: HTMLAttributes<HTMLElement>
  readonly propsDelEncabezado: HTMLAttributes<HTMLElement>
}

export default function FilaDeTeam({
  team,
  deshabilitado,
  opcionesDeGrupo,
  alCambiarGrupo,
  puedeSubir,
  puedeBajar,
  alMover,
  esDestino,
  propsDeLaFila,
  propsDelEncabezado
}: FilaDeTeamProps): ReactElement {
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function cambiarGrupo(grupoId: string | null): Promise<void> {
    setMensaje(null)
    const error = await alCambiarGrupo(grupoId)
    if (error !== null) {
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  return (
    <section
      className={esDestino ? 'fila-de-team fila-de-team--destino' : 'fila-de-team'}
      aria-labelledby={`team-${team.id}`}
      {...propsDeLaFila}
    >
      <header className="fila-de-team__encabezado" {...propsDelEncabezado}>
        <h4 className="fila-de-team__nombre" id={`team-${team.id}`}>
          {team.nombre}
        </h4>
        <SelectorDeGrupo
          valor={team.grupoId}
          opciones={opcionesDeGrupo}
          deshabilitado={deshabilitado}
          alCambiar={(grupoId) => void cambiarGrupo(grupoId)}
        />
        <ControlesDeOrden
          tipo="team"
          id={team.id}
          nombre={team.nombre}
          puedeSubir={puedeSubir}
          puedeBajar={puedeBajar}
          deshabilitado={deshabilitado}
          alMover={alMover}
        />
      </header>
      {mensaje !== null && (
        <p className="fila-de-team__mensaje" role="alert">
          {mensaje}
        </p>
      )}
    </section>
  )
}
