import { useId, useRef, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'

export interface PanelDePestana {
  readonly id: string
  readonly etiqueta: string
  readonly contenido: ReactNode
}

interface PestanasDeFichaProps {
  readonly paneles: readonly PanelDePestana[]
  readonly activa: string
  readonly alCambiar: (id: string) => void
}

export default function PestanasDeFicha({
  paneles,
  activa,
  alCambiar
}: PestanasDeFichaProps): ReactElement {
  const base = useId()
  const botones = useRef<Map<string, HTMLButtonElement>>(new Map())

  function ir(indice: number): void {
    const destino = paneles[(indice + paneles.length) % paneles.length]
    if (destino === undefined) {
      return
    }
    alCambiar(destino.id)
    botones.current.get(destino.id)?.focus()
  }

  function alPresionar(evento: KeyboardEvent, indice: number): void {
    const acciones: Readonly<Record<string, number>> = {
      ArrowRight: indice + 1,
      ArrowLeft: indice - 1,
      Home: 0,
      End: paneles.length - 1
    }
    const destino = acciones[evento.key]
    if (destino !== undefined) {
      evento.preventDefault()
      ir(destino)
    }
  }

  return (
    <div className="pestanas">
      <div className="pestanas__lista" role="tablist" aria-label="Bloques de la ficha">
        {paneles.map((panel, indice) => (
          <button
            key={panel.id}
            ref={(boton) => {
              if (boton === null) {
                botones.current.delete(panel.id)
              } else {
                botones.current.set(panel.id, boton)
              }
            }}
            type="button"
            role="tab"
            className="pestanas__pestana"
            id={`${base}-tab-${panel.id}`}
            aria-selected={panel.id === activa}
            aria-controls={`${base}-panel-${panel.id}`}
            tabIndex={panel.id === activa ? 0 : -1}
            onClick={() => alCambiar(panel.id)}
            onKeyDown={(evento) => alPresionar(evento, indice)}
          >
            {panel.etiqueta}
          </button>
        ))}
      </div>
      {paneles.map((panel) => (
        <div
          key={panel.id}
          role="tabpanel"
          className="pestanas__panel"
          id={`${base}-panel-${panel.id}`}
          aria-labelledby={`${base}-tab-${panel.id}`}
          data-pestana={panel.id}
          hidden={panel.id !== activa}
        >
          {panel.contenido}
        </div>
      ))}
    </div>
  )
}
