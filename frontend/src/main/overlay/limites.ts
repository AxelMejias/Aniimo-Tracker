import { tieneClaves } from '../teams/validacion'

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Tamanio {
  readonly width: number
  readonly height: number
}

export const LIMITES_POR_DEFECTO: Tamanio = { width: 360, height: 520 }
export const ANCHO_MINIMO = 280
export const ALTO_MINIMO = 200
const ANCHO_MAXIMO = 3840
const ALTO_MAXIMO = 2160
const ALTO_DE_BARRA = 32
const ANCHO_VISIBLE_MINIMO = 64

function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor)
}

export function esLimitesValidos(valor: unknown): valor is Rect {
  return (
    tieneClaves(valor, ['x', 'y', 'width', 'height']) &&
    esEntero(valor.x) &&
    esEntero(valor.y) &&
    esEntero(valor.width) &&
    esEntero(valor.height) &&
    valor.width >= ANCHO_MINIMO &&
    valor.width <= ANCHO_MAXIMO &&
    valor.height >= ALTO_MINIMO &&
    valor.height <= ALTO_MAXIMO
  )
}

function barraVisibleEn(limites: Rect, area: Rect): boolean {
  const ancho =
    Math.min(limites.x + limites.width, area.x + area.width) - Math.max(limites.x, area.x)
  const alto =
    Math.min(limites.y + ALTO_DE_BARRA, area.y + area.height) - Math.max(limites.y, area.y)
  return ancho >= ANCHO_VISIBLE_MINIMO && alto >= ALTO_DE_BARRA
}

export function ajustarAPantallas(
  limites: Rect | null,
  areas: readonly Rect[],
  principal: Rect
): Rect {
  if (limites !== null && areas.some((area) => barraVisibleEn(limites, area))) {
    return limites
  }
  return {
    x: Math.round(principal.x + (principal.width - LIMITES_POR_DEFECTO.width) / 2),
    y: Math.round(principal.y + (principal.height - LIMITES_POR_DEFECTO.height) / 2),
    width: LIMITES_POR_DEFECTO.width,
    height: LIMITES_POR_DEFECTO.height
  }
}
