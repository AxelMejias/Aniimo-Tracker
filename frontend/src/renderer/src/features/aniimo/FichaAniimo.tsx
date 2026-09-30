import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { ErrorDeTeams, Ficha } from '../../../../shared/teams'
import { mensajeDeErrorDeTeams } from '../teams/mensajes'
import EditorDeFicha from './EditorDeFicha'
import { recodificarImagen, type Recodificador } from './recodificarImagen'

interface FichaAniimoProps {
  readonly teamId: string
  readonly slot: number
  readonly alVolver: () => void
  readonly alSesionVencida: () => void
  readonly recodificar?: Recodificador
}

type EstadoDeCarga =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly error: ErrorDeTeams }
  | { readonly tipo: 'listo'; readonly ficha: Ficha | null }

export default function FichaAniimo({
  teamId,
  slot,
  alVolver,
  alSesionVencida,
  recodificar = recodificarImagen
}: FichaAniimoProps): ReactElement {
  const [estado, setEstado] = useState<EstadoDeCarga>({ tipo: 'cargando' })
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  useEffect(() => {
    let activo = true
    void window.aniimo.teams.obtenerFicha({ teamId, slot }).then((resultado) => {
      if (!activo) {
        return
      }
      if (resultado.ok) {
        setEstado({ tipo: 'listo', ficha: resultado.ficha })
      } else if (resultado.error === 'sesion-vencida') {
        sesionVencida.current()
      } else {
        setEstado({ tipo: 'error', error: resultado })
      }
    })
    return () => {
      activo = false
    }
  }, [teamId, slot])

  if (estado.tipo === 'cargando') {
    return <p className="ficha__estado">Cargando ficha…</p>
  }
  if (estado.tipo === 'error') {
    return (
      <div className="ficha__estado">
        <p role="alert">{mensajeDeErrorDeTeams(estado.error)}</p>
        <button type="button" onClick={alVolver}>
          Volver
        </button>
      </div>
    )
  }
  return (
    <EditorDeFicha
      teamId={teamId}
      slot={slot}
      inicial={estado.ficha}
      recodificar={recodificar}
      alVolver={alVolver}
      alSesionVencida={alSesionVencida}
    />
  )
}
