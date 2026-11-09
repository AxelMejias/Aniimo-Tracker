import type { ResumenDeAniimo, SlotDeTeam } from '../../../../shared/teams'

const MAXIMO_DE_CARTAS = 4

export interface CartaFlotante {
  readonly slot: number
  readonly aniimo: ResumenDeAniimo | null
  readonly posicion: 'c1' | 'c2' | 'c3' | 'c4'
}

export interface CartasDelAbanico {
  readonly cantidad: number
  readonly cartas: readonly CartaFlotante[]
}

const POSICIONES = ['c1', 'c2', 'c3', 'c4'] as const

export function cartasDelAbanico(slots: readonly SlotDeTeam[]): CartasDelAbanico {
  const visibles = slots.slice(0, MAXIMO_DE_CARTAS)
  return {
    cantidad: visibles.length,
    cartas: visibles.map(({ slot, aniimo }, indice) => ({
      slot,
      aniimo,
      posicion: POSICIONES[indice]!
    }))
  }
}
