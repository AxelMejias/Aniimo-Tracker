import type { ReactElement } from 'react'
import './BarraSvg.css'

interface BarraSvgProps {
  readonly largo: number
  readonly sentido?: 'derecha' | 'izquierda'
  readonly lado?: 'a' | 'b'
}

export default function BarraSvg({ largo, sentido = 'derecha', lado = 'a' }: BarraSvgProps): ReactElement {
  return (
    <svg
      className={`barra barra--${sentido} barra--${lado}`}
      viewBox="0 0 100 4"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="barra__fondo" x="0" y="0" width="100" height="4" />
      <rect className="barra__relleno" x="0" y="0" width={largo} height="4" />
    </svg>
  )
}
