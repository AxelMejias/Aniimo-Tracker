import type { ErrorDeAmigos } from '../../../../shared/amigos'

export const MENSAJE_NOMBRE_DE_USUARIO_INVALIDO =
  'El nombre de usuario debe tener entre 3 y 32 letras, números o guiones bajos'
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
      return 'Tu sesión venció, volvé a iniciar sesión'
    case 'sin-conexion':
      return 'No se pudo conectar con el servidor'
    case 'credenciales-invalidas':
    case 'nombre-no-disponible':
    case 'demasiados-intentos':
    case 'error-inesperado':
      return 'Ocurrió un error inesperado'
  }
}
