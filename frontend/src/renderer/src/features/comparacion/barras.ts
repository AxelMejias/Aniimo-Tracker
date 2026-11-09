export function largoDeBarra(valor: number | null, maximo: number): number | null {
  if (valor === null) {
    return null
  }
  if (valor <= 0 || maximo <= 0) {
    return 0
  }
  return Math.min(100, Math.round((valor / maximo) * 100))
}

export interface LargosDeFila {
  readonly izquierda: number | null
  readonly derecha: number | null
}

export function largosDeFila(izquierda: number | null, derecha: number | null): LargosDeFila {
  const maximo = Math.max(izquierda ?? 0, derecha ?? 0)
  return { izquierda: largoDeBarra(izquierda, maximo), derecha: largoDeBarra(derecha, maximo) }
}
