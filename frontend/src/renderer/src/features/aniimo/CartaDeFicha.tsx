import type { ReactElement, ReactNode } from 'react'
import { ELEMENTOS, ROLES } from '../../../../shared/catalogos'
import BarraSvg from '../../shared/components/BarraSvg'
import { largoDeBarra } from '../comparacion/barras'
import '../mazo/mazo.css'
import { POTENCIAL_MAXIMO } from './validacionFicha'

export interface PotencialDeStat {
  readonly codigo: string
  readonly etiqueta: string
  readonly valor: number | null
}

interface CartaDeFichaProps {
  readonly nombre: string
  readonly nivel: string
  readonly cp: string
  readonly elemento: string | null
  readonly rol: string | null
  readonly personalidad: string
  readonly esPortada: boolean
  readonly imagen: string | null
  readonly altDeImagen: string
  readonly potenciales: readonly PotencialDeStat[]
  readonly children?: ReactNode
}

export default function CartaDeFicha({
  nombre,
  nivel,
  cp,
  elemento,
  rol,
  personalidad,
  esPortada,
  imagen,
  altDeImagen,
  potenciales,
  children
}: CartaDeFichaProps): ReactElement {
  const elementoConocido = ELEMENTOS.find((e) => e.codigo === elemento)
  const tipo = [elementoConocido?.etiqueta, ROLES.find((r) => r.codigo === rol)?.etiqueta]
    .filter((parte) => parte !== undefined)
    .join(' · ')
  const titulo = nombre.trim() === '' ? 'Sin nombre' : nombre

  return (
    <div className="carta-ficha">
      <div className="carta carta--ficha">
        <div className="carta__banda">
          <span className="carta__nombre">{titulo}</span>
          <span className="carta__nivel">Nv {nivel}</span>
        </div>
        <div className={`carta__arte carta__arte--${elementoConocido?.codigo ?? 'neutro'}`}>
          {imagen === null ? (
            <>
              <svg
                className="carta__formas"
                viewBox="0 0 100 140"
                aria-hidden="true"
                focusable="false"
              >
                <circle className="carta__forma carta__forma--a" cx="78" cy="30" r="34" />
                <path
                  className="carta__forma carta__forma--b"
                  d="M0 140 L0 96 L46 64 L100 112 L100 140 Z"
                />
              </svg>
              <span className="carta__inicial" aria-hidden="true">
                {titulo.charAt(0).toUpperCase()}
              </span>
            </>
          ) : (
            <img className="carta__imagen" src={imagen} alt={altDeImagen} />
          )}
          {esPortada && <span className="carta__portada">Portada</span>}
        </div>
        <ul className="carta-ficha__barras" aria-label="Potencial por stat">
          {potenciales.map(({ codigo, etiqueta, valor }) => {
            const largo = largoDeBarra(valor, POTENCIAL_MAXIMO)
            return (
              <li className="carta-ficha__barra" key={codigo}>
                <span className="carta-ficha__stat">{etiqueta}</span>
                {largo === null ? (
                  <span className="carta-ficha__sin-barra" />
                ) : (
                  <BarraSvg largo={largo} />
                )}
                <span className="carta-ficha__numero">{valor ?? '—'}</span>
              </li>
            )
          })}
        </ul>
        <div className="carta__placa">
          <span className="carta__cp">CP {cp}</span>
          <span className="carta__estrella">{personalidad}</span>
          {tipo !== '' && <span className="carta__tipo">{tipo}</span>}
        </div>
      </div>
      {children}
    </div>
  )
}
