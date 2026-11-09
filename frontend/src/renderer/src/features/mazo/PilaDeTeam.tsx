import type { ReactElement } from 'react'
import type { SlotDeTeam } from '../../../../shared/teams'
import type { CargarImagenDeTarjeta } from '../teams/useImagenDeTarjeta'
import CartaAniimo from './CartaAniimo'
import { cartasDelAbanico } from './abanicoDeCartas'
import { partesDeLaPila } from './pila'
import './mazo.css'

interface PilaDeTeamProps {
  readonly teamId: string
  readonly nombre: string
  readonly slots: readonly SlotDeTeam[]
  readonly portadaSlot: number | null
  readonly ocultoParaAmigos: boolean
  readonly alAbrir: () => void
  readonly desplegada?: boolean
  readonly alEntrar?: () => void
  readonly alSalir?: () => void
  readonly numero?: number
  readonly oculta?: boolean
  readonly clase?: string
  readonly cargarImagen?: CargarImagenDeTarjeta
}

export default function PilaDeTeam({
  teamId,
  nombre,
  slots,
  portadaSlot,
  ocultoParaAmigos,
  alAbrir,
  desplegada = false,
  alEntrar,
  alSalir,
  numero,
  oculta = false,
  clase,
  cargarImagen
}: PilaDeTeamProps): ReactElement {
  const { cantidad, portada, detras } = partesDeLaPila(slots, portadaSlot)
  const flotantes = desplegada ? cartasDelAbanico(slots) : null
  const clases = ['pila', clase, desplegada ? 'pila--desplegada' : '']
    .filter((c) => c !== undefined && c !== '')
    .join(' ')

  return (
    <button
      type="button"
      className={clases}
      data-team-id={teamId}
      aria-label={`${numero === undefined ? '' : `${numero}: `}Team ${nombre}, ${cantidad} de 4 Aniimo`}
      {...(oculta ? { 'aria-hidden': true, tabIndex: -1 } : {})}
      onClick={alAbrir}
      onPointerEnter={alEntrar}
      onPointerLeave={alSalir}
    >
      <span className="pila__cartas">
        {detras.map(({ slot, aniimo }, i) => (
          <span
            key={slot}
            className={`pila__capa pila__capa--${i + 1} pila__capa--${aniimo.elemento ?? 'neutro'}`}
            aria-hidden="true"
          />
        ))}
        <span className="pila__portada">
          {portada === null ? (
            <span className="pila__vacia">Team vacío. Agregá tu primer Aniimo.</span>
          ) : (
            <CartaAniimo
              teamId={teamId}
              slot={portada.slot}
              aniimo={portada.aniimo}
              variante="mazo"
              {...(cargarImagen === undefined ? {} : { cargarImagen })}
            />
          )}
        </span>
      </span>
      {flotantes !== null && (
        <span className={`pila__abanico pila__abanico--n${flotantes.cantidad}`} aria-hidden="true">
          {flotantes.cartas.map(({ slot, aniimo, posicion }) => (
            <span key={slot} className={`pila__flotante pila__flotante--${posicion}`}>
              {aniimo === null ? (
                <span className="carta carta--mazo carta--vacia">Vacío</span>
              ) : (
                <CartaAniimo
                  teamId={teamId}
                  slot={slot}
                  aniimo={aniimo}
                  variante="mazo"
                  {...(cargarImagen === undefined ? {} : { cargarImagen })}
                />
              )}
            </span>
          ))}
        </span>
      )}
      <span className="pila__pie">
        {numero !== undefined && (
          <span className="pila__numero" aria-hidden="true">
            {numero}
          </span>
        )}
        <span className="pila__nombre">{nombre}</span>
        <span className="pila__contador">{cantidad}/4</span>
        {ocultoParaAmigos && <span className="pila__oculto">Oculto para amigos</span>}
      </span>
    </button>
  )
}
