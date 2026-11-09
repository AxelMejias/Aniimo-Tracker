import type { ResumenDeAniimo, SlotDeTeam } from '../../../../shared/teams'

export const MAXIMO_DE_CAPAS = 3

export interface Ocupado {
  readonly slot: number
  readonly aniimo: ResumenDeAniimo
}

export interface PartesDeLaPila {
  readonly cantidad: number
  readonly portada: Ocupado | null
  readonly detras: readonly Ocupado[]
}

export function partesDeLaPila(
  slots: readonly SlotDeTeam[],
  portadaSlot: number | null
): PartesDeLaPila {
  const ocupados = slots.flatMap(({ slot, aniimo }) => (aniimo === null ? [] : [{ slot, aniimo }]))
  const portada = ocupados.find((o) => o.slot === portadaSlot) ?? ocupados[0] ?? null
  const detras = ocupados.filter((o) => o !== portada).slice(0, MAXIMO_DE_CAPAS)
  return { cantidad: ocupados.length, portada, detras }
}
