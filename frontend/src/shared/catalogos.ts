export const ELEMENTOS = [
  { codigo: 'fuego', etiqueta: 'Fuego' },
  { codigo: 'agua', etiqueta: 'Agua' },
  { codigo: 'planta', etiqueta: 'Planta' },
  { codigo: 'electrico', etiqueta: 'Eléctrico' },
  { codigo: 'hielo', etiqueta: 'Hielo' },
  { codigo: 'roca', etiqueta: 'Roca' },
  { codigo: 'viento', etiqueta: 'Viento' },
  { codigo: 'sagrado', etiqueta: 'Sagrado' },
  { codigo: 'oscuro', etiqueta: 'Oscuro' }
] as const

export const ROLES = [
  { codigo: 'dps', etiqueta: 'DPS' },
  { codigo: 'ayuda', etiqueta: 'Ayuda' },
  { codigo: 'curacion', etiqueta: 'Curación' },
  { codigo: 'regen', etiqueta: 'Regen' },
  { codigo: 'break', etiqueta: 'Break' }
] as const

export const POTENCIALES_INNATOS = [
  { codigo: 'comun', etiqueta: 'Común' },
  { codigo: 'bueno', etiqueta: 'Bueno' },
  { codigo: 'elite', etiqueta: 'Élite' },
  { codigo: 'perfecto', etiqueta: 'Perfecto' }
] as const

export const RAREZAS = [
  { codigo: 'rara', etiqueta: 'Rara' },
  { codigo: 'epica', etiqueta: 'Épica' },
  { codigo: 'legendaria', etiqueta: 'Legendaria' }
] as const

export const POSICIONES_DE_OBJETO = [
  { codigo: 'equipado', etiqueta: 'Equipado' },
  { codigo: 'alternativo', etiqueta: 'Alternativo' }
] as const

export const STATS = [
  { codigo: 'ps', etiqueta: 'PS' },
  { codigo: 'atq', etiqueta: 'ATQ' },
  { codigo: 'def_fisica', etiqueta: 'DEF física' },
  { codigo: 'def_magica', etiqueta: 'DEF mágica' },
  { codigo: 'regen', etiqueta: 'Regen' },
  { codigo: 'quiebre', etiqueta: 'Quiebre' }
] as const

export const LETRAS_DE_PERSONALIDAD = [
  ['E', 'I'],
  ['N', 'S'],
  ['T', 'F'],
  ['J', 'P']
] as const

export type CodigoDeElemento = (typeof ELEMENTOS)[number]['codigo']
export type CodigoDeRol = (typeof ROLES)[number]['codigo']
export type CodigoDePotencialInnato = (typeof POTENCIALES_INNATOS)[number]['codigo']
export type CodigoDeRareza = (typeof RAREZAS)[number]['codigo']
export type CodigoDePosicionDeObjeto = (typeof POSICIONES_DE_OBJETO)[number]['codigo']
export type CodigoDeStat = (typeof STATS)[number]['codigo']

export const PATRON_DE_PERSONALIDAD = /^[EI][NS][TF][JP]$/

export function esCodigoDe(catalogo: readonly { readonly codigo: string }[], valor: unknown): boolean {
  return typeof valor === 'string' && catalogo.some((entrada) => entrada.codigo === valor)
}
