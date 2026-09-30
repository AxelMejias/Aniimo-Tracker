import type { Credenciales } from '../../../../shared/auth'

const NOMBRE_VALIDO = /^[A-Za-z0-9_]{3,32}$/
const LARGO_MINIMO_CONTRASENA = 12
const LARGO_MAXIMO_CONTRASENA = 128

// Solo ayuda al usuario: la validacion que vale es la del backend.
export function validarRegistro({ nombreUsuario, contrasena }: Credenciales): string | null {
  if (!NOMBRE_VALIDO.test(nombreUsuario)) {
    return 'El usuario debe tener entre 3 y 32 caracteres: letras, números y guion bajo, sin espacios'
  }
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`
  }
  if (contrasena.length > LARGO_MAXIMO_CONTRASENA) {
    return `La contraseña no puede superar los ${LARGO_MAXIMO_CONTRASENA} caracteres`
  }
  return null
}
