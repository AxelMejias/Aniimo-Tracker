import type { ReactElement } from 'react'
import type { ResumenDeAniimo, TeamResumen } from '../../../../shared/teams'
import { useImagenDeTarjeta } from '../teams/useImagenDeTarjeta'

interface TeamCompactoProps {
  readonly team: TeamResumen
  readonly alAbrirSlot: (slot: number) => void
}

interface SlotCompactoProps {
  readonly teamId: string
  readonly slot: number
  readonly aniimo: ResumenDeAniimo
  readonly alAbrir: (slot: number) => void
}

function SlotCompacto({ teamId, slot, aniimo, alAbrir }: SlotCompactoProps): ReactElement {
  const imagen = useImagenDeTarjeta(teamId, slot, aniimo.tieneImagen)
  return (
    <button type="button" className="overlay__slot" onClick={() => alAbrir(slot)}>
      <span className="overlay__slot-nombre">{aniimo.nombre}</span>
      <span className={`overlay__slot-arte overlay__slot-arte--${aniimo.elemento ?? 'neutro'}`}>
        {imagen === null ? (
          <span className="overlay__slot-inicial" aria-hidden="true">
            {aniimo.nombre.charAt(0).toUpperCase()}
          </span>
        ) : (
          <img className="overlay__slot-imagen" src={imagen} alt="" />
        )}
      </span>
      <span className="overlay__slot-datos">
        <span>
          Nv {aniimo.nivel} · CP {aniimo.cp}
        </span>
        <span>Estrella {aniimo.estrellaActual}</span>
      </span>
    </button>
  )
}

export default function TeamCompacto({ team, alAbrirSlot }: TeamCompactoProps): ReactElement {
  return (
    <div className="overlay__slots">
      {team.slots.map((slot) =>
        slot.aniimo === null ? (
          <div key={slot.slot} className="overlay__slot-vacio">
            Slot vacío
          </div>
        ) : (
          <SlotCompacto
            key={slot.slot}
            teamId={team.id}
            slot={slot.slot}
            aniimo={slot.aniimo}
            alAbrir={alAbrirSlot}
          />
        )
      )}
    </div>
  )
}
