import { useEffect, useRef, type ReactElement } from 'react'
import './Confirmacion.css'

interface ConfirmacionProps {
  readonly mensaje: string
  readonly deshabilitado: boolean
  readonly etiquetaConfirmar?: string
  readonly alConfirmar: () => void
  readonly alCancelar: () => void
}

export default function Confirmacion({
  mensaje,
  deshabilitado,
  etiquetaConfirmar = 'Confirmar borrado',
  alConfirmar,
  alCancelar
}: ConfirmacionProps): ReactElement {
  const botonCancelar = useRef<HTMLButtonElement>(null)
  const cancelar = useRef(alCancelar)
  cancelar.current = alCancelar

  useEffect(() => {
    botonCancelar.current?.focus()
  }, [])

  useEffect(() => {
    if (deshabilitado) {
      return
    }
    function alPresionar(evento: KeyboardEvent): void {
      if (evento.key === 'Escape') {
        cancelar.current()
      }
    }
    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [deshabilitado])

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
          {etiquetaConfirmar}
        </button>
        <button ref={botonCancelar} type="button" disabled={deshabilitado} onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
