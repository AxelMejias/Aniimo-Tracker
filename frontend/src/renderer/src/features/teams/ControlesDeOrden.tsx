import type { ReactElement } from 'react'
import type { Direccion } from './destinoDeArrastre'

interface ControlesDeOrdenProps {
  readonly tipo: 'grupo' | 'team'
  readonly id: string
  readonly nombre: string
  readonly puedeSubir: boolean
  readonly puedeBajar: boolean
  readonly deshabilitado: boolean
  readonly alMover: (direccion: Direccion) => void
}

export function idDeBotonDeOrden(tipo: 'grupo' | 'team', id: string, direccion: Direccion): string {
  return `${direccion}-${tipo}-${id}`
}

export default function ControlesDeOrden({
  tipo,
  id,
  nombre,
  puedeSubir,
  puedeBajar,
  deshabilitado,
  alMover
}: ControlesDeOrdenProps): ReactElement {
  return (
    <span className="controles-de-orden">
      <button
        id={idDeBotonDeOrden(tipo, id, 'subir')}
        type="button"
        aria-label={`Subir ${tipo} ${nombre}`}
        disabled={deshabilitado || !puedeSubir}
        onClick={() => alMover('subir')}
      >
        Subir
      </button>
      <button
        id={idDeBotonDeOrden(tipo, id, 'bajar')}
        type="button"
        aria-label={`Bajar ${tipo} ${nombre}`}
        disabled={deshabilitado || !puedeBajar}
        onClick={() => alMover('bajar')}
      >
        Bajar
      </button>
    </span>
  )
}
