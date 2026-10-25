import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import type { Amigo, Solicitud } from '../../../../shared/amigos'

export interface EstadoDeAmigos {
  readonly amigos: readonly Amigo[]
  readonly recibidas: readonly Solicitud[]
  readonly enviadas: readonly Solicitud[]
  readonly cargado: boolean
  refrescar(): Promise<void>
}

const VACIO = { amigos: [], recibidas: [], enviadas: [], cargado: false } as const

const Contexto = createContext<EstadoDeAmigos | null>(null)

interface ProveedorDeAmigosProps {
  readonly alSesionVencida: () => void
  readonly children: ReactNode
}

export function ProveedorDeAmigos({
  alSesionVencida,
  children
}: ProveedorDeAmigosProps): ReactElement {
  const [datos, setDatos] = useState<Omit<EstadoDeAmigos, 'refrescar'>>(VACIO)
  const enVuelo = useRef<Promise<void> | null>(null)
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  // Los disparos que llegan con una lectura en curso comparten esa misma promesa.
  const refrescar = useCallback((): Promise<void> => {
    if (enVuelo.current !== null) {
      return enVuelo.current
    }
    const promesa = window.aniimo.amigos
      .listar()
      .then((resultado) => {
        if (resultado.ok) {
          const { amigos, recibidas, enviadas } = resultado
          setDatos({ amigos, recibidas, enviadas, cargado: true })
        } else if (resultado.error === 'sesion-vencida') {
          sesionVencida.current()
        }
      })
      .catch(() => undefined)
      .finally(() => {
        enVuelo.current = null
      })
    enVuelo.current = promesa
    return promesa
  }, [])

  const valor = useMemo(() => ({ ...datos, refrescar }), [datos, refrescar])
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useEstadoDeAmigos(): EstadoDeAmigos {
  const estado = useContext(Contexto)
  if (estado === null) {
    throw new Error('useEstadoDeAmigos requiere un ProveedorDeAmigos')
  }
  return estado
}
