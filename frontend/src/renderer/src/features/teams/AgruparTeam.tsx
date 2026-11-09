import { useState, type ReactElement } from 'react'
import type { ErrorDeTeams } from '../../../../shared/teams'
import { mensajeDeErrorDeTeams } from './mensajes'
import type { OpcionDeGrupo } from './secciones'
import SelectorDeGrupo from './SelectorDeGrupo'

interface AgruparTeamProps {
  readonly opciones: readonly OpcionDeGrupo[]
  readonly deshabilitado: boolean
  readonly alAgrupar: (grupoId: string) => Promise<ErrorDeTeams | null>
}

export default function AgruparTeam({
  opciones,
  deshabilitado,
  alAgrupar
}: AgruparTeamProps): ReactElement {
  const [abierto, setAbierto] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function agrupar(grupoId: string | null): Promise<void> {
    if (grupoId === null) {
      return
    }
    setMensaje(null)
    const error = await alAgrupar(grupoId)
    if (error !== null) {
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  return (
    <div className="agrupar-team">
      <button type="button" disabled={deshabilitado} onClick={() => setAbierto((actual) => !actual)}>
        Agrupar
      </button>
      {abierto && (
        <SelectorDeGrupo
          valor={null}
          opciones={opciones}
          deshabilitado={deshabilitado}
          alCambiar={(grupoId) => void agrupar(grupoId)}
        />
      )}
      {mensaje !== null && (
        <p className="agrupar-team__mensaje" role="alert">
          {mensaje}
        </p>
      )}
    </div>
  )
}
