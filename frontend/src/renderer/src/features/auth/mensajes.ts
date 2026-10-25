import type { ErrorDeAuth } from '../../../../shared/auth'
import {
  MENSAJE_ERROR_INESPERADO,
  MENSAJE_SESION_VENCIDA,
  MENSAJE_SIN_CONEXION
} from '../../shared/mensajes'

function describirEspera(segundos: number): string {
  if (segundos < 60) {
    return `${segundos} segundos`
  }
  const minutos = Math.ceil(segundos / 60)
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`
}

export function mensajeDeError(resultado: ErrorDeAuth): string {
  switch (resultado.error) {
    case 'credenciales-invalidas':
      return 'Usuario o contraseña incorrectos'
    case 'nombre-no-disponible':
      return 'El nombre de usuario no está disponible'
    case 'datos-invalidos':
      return 'Revisá los datos ingresados'
    case 'demasiados-intentos':
      return resultado.reintentarEnSegundos === undefined
        ? 'Demasiados intentos, probá más tarde'
        : `Demasiados intentos, probá de nuevo en ${describirEspera(resultado.reintentarEnSegundos)}`
    case 'sesion-vencida':
      return MENSAJE_SESION_VENCIDA
    case 'sin-conexion':
      return MENSAJE_SIN_CONEXION
    case 'error-inesperado':
      return MENSAJE_ERROR_INESPERADO
  }
}
