import type { ReactElement } from 'react'
import { ELEMENTOS, ROLES } from '../../../../shared/catalogos'
import type { ResumenDeAniimo } from '../../../../shared/teams'
import {
  useImagenDeTarjeta,
  type CargarImagenDeTarjeta
} from '../teams/useImagenDeTarjeta'
import './mazo.css'

export type VarianteDeCarta = 'mazo' | 'team' | 'ficha'

interface CartaAniimoProps {
  readonly teamId: string
  readonly slot: number
  readonly aniimo: ResumenDeAniimo
  readonly variante: VarianteDeCarta
  readonly esPortada?: boolean
  readonly cargarImagen?: CargarImagenDeTarjeta
}

function etiquetaDeTipo(aniimo: ResumenDeAniimo): string {
  const elemento = ELEMENTOS.find((e) => e.codigo === aniimo.elemento)?.etiqueta
  const rol = ROLES.find((r) => r.codigo === aniimo.rol)?.etiqueta
  return [elemento, rol].filter((parte) => parte !== undefined).join(' · ')
}

export default function CartaAniimo({
  teamId,
  slot,
  aniimo,
  variante,
  esPortada = false,
  cargarImagen
}: CartaAniimoProps): ReactElement {
  const imagen = useImagenDeTarjeta(teamId, slot, aniimo.tieneImagen, cargarImagen)
  const tipo = etiquetaDeTipo(aniimo)

  return (
    <span className={`carta carta--${variante}`}>
      <span className="carta__banda">
        <span className="carta__nombre">{aniimo.nombre}</span>
        <span className="carta__nivel">Nv {aniimo.nivel}</span>
      </span>
      <span className={`carta__arte carta__arte--${aniimo.elemento ?? 'neutro'}`}>
        {imagen === null ? (
          <>
            <svg className="carta__formas" viewBox="0 0 100 140" aria-hidden="true" focusable="false">
              <circle className="carta__forma carta__forma--a" cx="78" cy="30" r="34" />
              <path className="carta__forma carta__forma--b" d="M0 140 L0 96 L46 64 L100 112 L100 140 Z" />
            </svg>
            <span className="carta__inicial" aria-hidden="true">
              {aniimo.nombre.charAt(0).toUpperCase()}
            </span>
          </>
        ) : (
          <img className="carta__imagen" src={imagen} alt={`Imagen de ${aniimo.nombre}`} />
        )}
        {esPortada && <span className="carta__portada">Portada</span>}
      </span>
      <span className="carta__placa">
        <span className="carta__cp">CP {aniimo.cp}</span>
        <span className="carta__estrella">Estrella {aniimo.estrellaActual}</span>
        {tipo !== '' && <span className="carta__tipo">{tipo}</span>}
      </span>
    </span>
  )
}
