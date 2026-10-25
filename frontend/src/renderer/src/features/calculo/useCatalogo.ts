import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogoResumen } from '../../../../shared/calculo'
import { mensajeDeErrorDeCalculo } from './mensajes'

export type EstadoDelCatalogo =
  | { readonly tipo: 'inactivo' }
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'listo'; readonly catalogo: CatalogoResumen }
  | { readonly tipo: 'error'; readonly mensaje: string }

export interface CatalogoCompartido {
  readonly estado: EstadoDelCatalogo
  readonly solicitar: () => void
}

export function useCatalogoCompartido(alSesionVencida: () => void): CatalogoCompartido {
  const [estado, setEstado] = useState<EstadoDelCatalogo>({ tipo: 'inactivo' })
  const montado = useRef(true)
  const solicitado = useRef(false)
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const solicitar = useCallback((): void => {
    if (solicitado.current) {
      return
    }
    solicitado.current = true
    setEstado({ tipo: 'cargando' })
    void window.aniimo.calculo.obtenerCatalogo().then((resultado) => {
      if (!montado.current) {
        return
      }
      if (resultado.ok) {
        setEstado({ tipo: 'listo', catalogo: resultado.catalogo })
      } else if (resultado.error === 'sesion-vencida') {
        sesionVencida.current()
      } else {
        setEstado({ tipo: 'error', mensaje: mensajeDeErrorDeCalculo(resultado.error) })
      }
    })
  }, [])

  return { estado, solicitar }
}
