import type { ReactElement } from 'react'
import './Confirmacion.css'

interface ConfirmacionProps {
  readonly mensaje: string
  readonly deshabilitado: boolean
  readonly alConfirmar: () => void
  readonly alCancelar: () => void
}

export default function Confirmacion({
  mensaje,
  deshabilitado,
  alConfirmar,
  alCancelar
}: ConfirmacionProps): ReactElement {
  return (
    <div className="confirmacion" role="alertdialog" aria-label="Confirmación">
      <p className="confirmacion__mensaje">{mensaje}</p>
      <div className="confirmacion__acciones">
        <button
          className="confirmacion__confirmar"
          type="button"
          disabled={deshabilitado}
          onClick={alConfirmar}
        >
          Confirmar borrado
        </button>
        <button type="button" disabled={deshabilitado} onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
