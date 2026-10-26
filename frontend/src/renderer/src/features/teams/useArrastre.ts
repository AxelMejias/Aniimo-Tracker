import { useCallback, useState, type DragEvent, type HTMLAttributes } from 'react'
import {
  destinoDeSoltar,
  type Arrastrado,
  type Destino,
  type Objetivo
} from './destinoDeArrastre'
import type { Secciones } from './secciones'

export const TIPO_DE_ARRASTRE = {
  grupo: 'application/x-aniimo-grupo',
  team: 'application/x-aniimo-team'
} as const

export interface UseArrastre {
  propsDeOrigen(arrastrado: Arrastrado): HTMLAttributes<HTMLElement>
  propsDeDestino(objetivo: Objetivo): HTMLAttributes<HTMLElement>
  esDestinoMarcado(objetivo: Objetivo): boolean
}

function claveDe(objetivo: Objetivo): string {
  return objetivo.tipo === 'sin-grupo' ? 'sin-grupo' : `${objetivo.tipo}:${objetivo.id}`
}

function esDeLaApp(evento: DragEvent, arrastrado: Arrastrado | null): arrastrado is Arrastrado {
  if (arrastrado === null) {
    return false
  }
  const tipos = Array.from(evento.dataTransfer.types)
  return tipos.includes(TIPO_DE_ARRASTRE[arrastrado.tipo])
}

export function useArrastre(
  secciones: Secciones,
  bloqueado: boolean,
  alSoltar: (destino: Destino) => void
): UseArrastre {
  const [arrastrado, setArrastrado] = useState<Arrastrado | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)

  const terminar = useCallback(() => {
    setArrastrado(null)
    setSobre(null)
  }, [])

  const propsDeOrigen = (origen: Arrastrado): HTMLAttributes<HTMLElement> => ({
    draggable: !bloqueado,
    onDragStart: (evento) => {
      if (bloqueado) {
        evento.preventDefault()
        return
      }
      evento.stopPropagation()
      evento.dataTransfer.setData(TIPO_DE_ARRASTRE[origen.tipo], origen.id)
      evento.dataTransfer.effectAllowed = 'move'
      setArrastrado(origen)
    },
    onDragEnd: terminar
  })

  const destinoPara = (evento: DragEvent, objetivo: Objetivo): Destino | null => {
    if (bloqueado || !esDeLaApp(evento, arrastrado)) {
      return null
    }
    return destinoDeSoltar(secciones, arrastrado, objetivo)
  }

  const propsDeDestino = (objetivo: Objetivo): HTMLAttributes<HTMLElement> => ({
    onDragOver: (evento) => {
      if (destinoPara(evento, objetivo) === null) {
        setSobre(null)
        return
      }
      evento.preventDefault()
      evento.stopPropagation()
      evento.dataTransfer.dropEffect = 'move'
      setSobre(claveDe(objetivo))
    },
    onDrop: (evento) => {
      const destino = destinoPara(evento, objetivo)
      if (destino === null) {
        return
      }
      evento.preventDefault()
      evento.stopPropagation()
      terminar()
      alSoltar(destino)
    }
  })

  return {
    propsDeOrigen,
    propsDeDestino,
    esDestinoMarcado: (objetivo) => sobre === claveDe(objetivo)
  }
}
