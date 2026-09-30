import {
  LARGO_MAXIMO_CONTRASENA,
  LARGO_MAXIMO_NOMBRE,
  type Credenciales
} from '../../shared/auth'

export function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null) {
    return false
  }
  const prototipo = Object.getPrototypeOf(valor)
  return prototipo === Object.prototype || prototipo === null
}

const CLAVES_ESPERADAS = ['contrasena', 'nombreUsuario']

export function esCredenciales(valor: unknown): valor is Credenciales {
  if (!esObjetoPlano(valor)) {
    return false
  }
  const claves = Reflect.ownKeys(valor).map(String).sort()
  if (claves.length !== CLAVES_ESPERADAS.length || claves.some((c, i) => c !== CLAVES_ESPERADAS[i])) {
    return false
  }
  const { nombreUsuario, contrasena } = valor
  return (
    typeof nombreUsuario === 'string' &&
    typeof contrasena === 'string' &&
    nombreUsuario.length <= LARGO_MAXIMO_NOMBRE &&
    contrasena.length <= LARGO_MAXIMO_CONTRASENA
  )
}
