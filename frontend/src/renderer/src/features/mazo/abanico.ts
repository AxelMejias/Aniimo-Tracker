export type ClaseDePosicion = 'p0' | 'p1' | 'p2' | 'p3' | 'p4'

export interface PosicionDeTeam {
  readonly teamId: string
  readonly numero: number
  readonly posicion: ClaseDePosicion
  readonly enfocable: boolean
}

const POSICIONES_DEL_RESTO: readonly ClaseDePosicion[] = ['p1', 'p2', 'p3', 'p4']

export function posicionesDelAbanico(
  teamIds: readonly string[],
  portadaId: string | null,
  abierto: boolean
): PosicionDeTeam[] {
  const portada = teamIds.includes(portadaId ?? '') ? portadaId : (teamIds[0] ?? null)
  let siguiente = 0
  return teamIds.map((teamId, indice) => {
    const esPortada = teamId === portada
    const posicion = esPortada ? 'p0' : POSICIONES_DEL_RESTO[Math.min(siguiente++, 3)]!
    return { teamId, numero: indice + 1, posicion, enfocable: abierto || esPortada }
  })
}
