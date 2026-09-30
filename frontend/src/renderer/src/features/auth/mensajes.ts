import type { ErrorDeAuth } from '../../../../shared/auth'

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
      return 'Tu sesión venció, volvé a iniciar sesión'
    case 'sin-conexion':
      return 'No se pudo conectar con el servidor'
    case 'error-inesperado':
      return 'Ocurrió un error inesperado'
  }
}
