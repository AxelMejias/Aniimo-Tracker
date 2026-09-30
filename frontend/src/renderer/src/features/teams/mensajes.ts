import type { ErrorDeTeams } from '../../../../shared/teams'

export const MENSAJE_NOMBRE_DE_TEAM_INVALIDO =
  'El nombre del team debe tener entre 1 y 50 caracteres'

export function mensajeDeErrorDeTeams(resultado: ErrorDeTeams): string {
  switch (resultado.error) {
    case 'limite-de-teams':
      return 'Ya tenés el máximo de 4 teams'
    case 'datos-invalidos':
      return 'Revisá los datos ingresados'
    case 'no-encontrado':
      return 'No se encontró el elemento, volvé a cargar la lista'
    case 'conflicto':
      return 'No se pudo guardar por un conflicto, intentá de nuevo'
    case 'imagen-invalida':
      return 'La imagen no es válida: solo PNG, JPEG o WebP de hasta 1 MiB'
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
