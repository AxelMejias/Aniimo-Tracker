export const NOMBRES_DEL_JUEGO = ['Aniimo.exe'] as const

const FORMA_DE_NOMBRE = /^[A-Za-z0-9 ._-]{1,64}\.exe$/

export function esNombreDeProcesoValido(nombre: string): boolean {
  return FORMA_DE_NOMBRE.test(nombre)
}
