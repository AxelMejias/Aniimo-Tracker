import type { Credenciales } from '../../../../shared/auth'

// Solo para desarrollo: los datos vienen de frontend/.env.development.local (ignorado por git),
// que Vite no carga al compilar para produccion.
export function leerCuentaDeTest(): Credenciales | null {
  if (!import.meta.env.DEV) {
    return null
  }
  const nombreUsuario: unknown = import.meta.env.VITE_CUENTA_TEST_USUARIO
  const contrasena: unknown = import.meta.env.VITE_CUENTA_TEST_CONTRASENA
  if (typeof nombreUsuario !== 'string' || typeof contrasena !== 'string') {
    return null
  }
  if (nombreUsuario === '' || contrasena === '') {
    return null
  }
  return { nombreUsuario, contrasena }
}
