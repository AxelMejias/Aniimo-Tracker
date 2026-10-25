import type { ReactElement } from 'react'
import type { ResumenDeAniimo } from '../../../../shared/teams'
import { useImagenDeTarjeta, type CargarImagenDeTarjeta } from './useImagenDeTarjeta'

interface TarjetaAniimoProps {
  readonly teamId: string
  readonly slot: number
  readonly aniimo: ResumenDeAniimo | null
  readonly deshabilitado: boolean
  readonly alAbrir: (slot: number) => void
  readonly cargarImagen?: CargarImagenDeTarjeta
  readonly soloLectura?: boolean
}

export default function TarjetaAniimo({
  teamId,
  slot,
  aniimo,
  deshabilitado,
  alAbrir,
  cargarImagen,
  soloLectura = false
}: TarjetaAniimoProps): ReactElement {
  const imagen = useImagenDeTarjeta(teamId, slot, aniimo?.tieneImagen ?? false, cargarImagen)

  if (aniimo === null) {
    if (soloLectura) {
      return <div className="tarjeta-aniimo tarjeta-aniimo--vacia">Vacío</div>
    }
    return (
      <button
        className="tarjeta-aniimo tarjeta-aniimo--vacia"
        type="button"
        disabled={deshabilitado}
        onClick={() => alAbrir(slot)}
      >
        Agregar Aniimo
      </button>
    )
  }
  return (
    <button
      className="tarjeta-aniimo"
      type="button"
      disabled={deshabilitado}
      onClick={() => alAbrir(slot)}
    >
      {imagen === null ? (
        <span className="tarjeta-aniimo__marcador" aria-hidden="true">
          {aniimo.nombre.charAt(0).toUpperCase()}
        </span>
      ) : (
        <img className="tarjeta-aniimo__imagen" src={imagen} alt="" />
      )}
      <span className="tarjeta-aniimo__nombre">{aniimo.nombre}</span>
      <span className="tarjeta-aniimo__dato">Nivel {aniimo.nivel}</span>
      <span className="tarjeta-aniimo__dato">CP {aniimo.cp}</span>
      {aniimo.personalidad !== null && (
        <span className="tarjeta-aniimo__dato">{aniimo.personalidad}</span>
      )}
      <span className="tarjeta-aniimo__dato">Estrella {aniimo.estrellaActual}</span>
      <span className="tarjeta-aniimo__dato">
        Despertar {aniimo.despertaresUsados}/{aniimo.despertaresTotal}
      </span>
    </button>
  )
}
