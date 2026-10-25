export type Vista = 'overlay' | 'principal'

export function vistaDesdeHash(hash: string): Vista {
  return hash === '#overlay' ? 'overlay' : 'principal'
}
