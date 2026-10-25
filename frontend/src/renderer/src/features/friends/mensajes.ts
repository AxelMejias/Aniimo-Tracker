import type { ErrorDeAmigos } from '../../../../shared/amigos'
import {
  MENSAJE_ERROR_INESPERADO,
  MENSAJE_NOMBRE_DE_USUARIO_INVALIDO,
  MENSAJE_SESION_VENCIDA,
  MENSAJE_SIN_CONEXION
} from '../../shared/mensajes'

export { MENSAJE_NOMBRE_DE_USUARIO_INVALIDO }
export const MENSAJE_BUSQUEDA_PROPIA = 'Ese es tu usuario'
export const MENSAJE_SIN_ACCESO = 'Ya no tenés acceso a esos datos'

export function mensajeDeErrorDeAmigos(resultado: ErrorDeAmigos): string {
  switch (resultado.error) {
    case 'ya-existe':
      return 'Ya hay una solicitud o amistad con ese usuario'
    case 'no-encontrado':
      return 'No se encontró al usuario, actualizá las listas'
    case 'datos-invalidos':
      return MENSAJE_NOMBRE_DE_USUARIO_INVALIDO
    case 'sesion-vencida':
      return MENSAJE_SESION_VENCIDA
    case 'sin-conexion':
      return MENSAJE_SIN_CONEXION
    case 'credenciales-invalidas':
    case 'nombre-no-disponible':
    case 'demasiados-intentos':
    case 'error-inesperado':
      return MENSAJE_ERROR_INESPERADO
  }
}
