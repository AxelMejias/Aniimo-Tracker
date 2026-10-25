import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { DuenioDeTeams, ErrorDeAmigos } from '../../../../shared/amigos'
import type { FichaDeAmigo as DatosDeFicha } from '../../../../shared/teams'
import FichaDeSoloLectura from '../aniimo/FichaDeSoloLectura'
import { mensajeDeErrorDeAmigos } from './mensajes'

interface FichaDeAmigoProps {
  readonly amigo: DuenioDeTeams
  readonly teamId: string
  readonly slot: number
  readonly alVolver: () => void
  readonly alComparar: () => void
  readonly alSinAcceso: () => void
  readonly alSesionVencida: () => void
}

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly error: ErrorDeAmigos }
  | { readonly tipo: 'vacia' }
  | { readonly tipo: 'lista'; readonly ficha: DatosDeFicha }

export default function FichaDeAmigo({
  amigo,
  teamId,
  slot,
  alVolver,
  alComparar,
  alSinAcceso,
  alSesionVencida
}: FichaDeAmigoProps): ReactElement {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [imagen, setImagen] = useState<string | null>(null)
  const avisos = useRef({ alSinAcceso, alSesionVencida })
  avisos.current = { alSinAcceso, alSesionVencida }

  useEffect(() => {
    let activo = true
    const pedido = { usuarioId: amigo.id, teamId, slot }
    void window.aniimo.amigos.obtenerFicha(pedido).then((resultado) => {
      if (!activo) {
        return
      }
      if (!resultado.ok) {
        if (resultado.error === 'sesion-vencida') {
          avisos.current.alSesionVencida()
        } else if (resultado.error === 'no-encontrado') {
          avisos.current.alSinAcceso()
        } else {
          setEstado({ tipo: 'error', error: resultado })
        }
        return
      }
      if (resultado.ficha === null) {
        setEstado({ tipo: 'vacia' })
        return
      }
      const { ficha } = resultado
      setEstado({ tipo: 'lista', ficha })
      if (ficha.tieneImagen) {
        void window.aniimo.amigos.obtenerImagen(pedido).then((respuesta) => {
          if (activo && respuesta.ok) {
            setImagen(respuesta.imagen)
          }
        })
      }
    })
    return () => {
      activo = false
    }
  }, [amigo.id, teamId, slot])

  if (estado.tipo === 'cargando') {
    return <p className="ficha__estado">Cargando ficha…</p>
  }
  if (estado.tipo === 'error' || estado.tipo === 'vacia') {
    return (
      <div className="ficha__estado">
        <p role="alert">
          {estado.tipo === 'error'
            ? mensajeDeErrorDeAmigos(estado.error)
            : 'Este slot ya no tiene un Aniimo'}
        </p>
        <button type="button" onClick={alVolver}>
          Volver
        </button>
      </div>
    )
  }
  return (
    <section className="principal__seccion">
      <FichaDeSoloLectura ficha={estado.ficha} imagen={imagen} />
      <div className="ficha__acciones">
        <button type="button" onClick={alComparar}>
          Comparar
        </button>
        <button type="button" onClick={alVolver}>
          Volver
        </button>
      </div>
    </section>
  )
}
