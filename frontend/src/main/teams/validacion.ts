import {
  ELEMENTOS,
  esCodigoDe,
  PATRON_DE_PERSONALIDAD,
  POSICIONES_DE_OBJETO,
  POTENCIALES_INNATOS,
  RAREZAS,
  ROLES,
  STATS
} from '../../shared/catalogos'
import {
  LARGO_MAXIMO_EFECTO_NUCLEO,
  LARGO_MAXIMO_NOMBRE_CORTO,
  LARGO_MAXIMO_NOTAS,
  LARGO_MAXIMO_NOTAS_DE_STAT,
  TAMANO_MAXIMO_DE_IMAGEN,
  TIPOS_DE_IMAGEN,
  type FichaEntrada,
  type PedidoCrear,
  type PedidoDeSlot,
  type PedidoDeTeam,
  type PedidoGuardarFicha,
  type PedidoRenombrar
} from '../../shared/teams'
import { esObjetoPlano } from '../auth/validacion'

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ClasificacionDePedidoDeImagen = 'valido' | 'datos-invalidos' | 'imagen-invalida'

function tieneClaves(valor: unknown, claves: readonly string[]): valor is Record<string, unknown> {
  if (!esObjetoPlano(valor)) {
    return false
  }
  const presentes = Reflect.ownKeys(valor).map(String).sort()
  const esperadas = [...claves].sort()
  return presentes.length === esperadas.length && presentes.every((c, i) => c === esperadas[i])
}

function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor)
}

function esTexto(valor: unknown, maximo: number): valor is string {
  return typeof valor === 'string' && valor.length <= maximo
}

function esTextoONulo(valor: unknown, maximo: number): boolean {
  return valor === null || esTexto(valor, maximo)
}

function esCatalogoONulo(
  catalogo: readonly { readonly codigo: string }[],
  valor: unknown
): boolean {
  return valor === null || esCodigoDe(catalogo, valor)
}

function esIdDeTeam(valor: unknown): valor is string {
  return typeof valor === 'string' && PATRON_UUID.test(valor)
}

function esSlot(valor: unknown): valor is number {
  return esEntero(valor) && valor >= 1 && valor <= 4
}

export function esPedidoCrear(valor: unknown): valor is PedidoCrear {
  return tieneClaves(valor, ['nombre']) && esTexto(valor.nombre, LARGO_MAXIMO_NOMBRE_CORTO)
}

export function esPedidoDeTeam(valor: unknown): valor is PedidoDeTeam {
  return tieneClaves(valor, ['teamId']) && esIdDeTeam(valor.teamId)
}

export function esPedidoRenombrar(valor: unknown): valor is PedidoRenombrar {
  return (
    tieneClaves(valor, ['teamId', 'nombre']) &&
    esIdDeTeam(valor.teamId) &&
    esTexto(valor.nombre, LARGO_MAXIMO_NOMBRE_CORTO)
  )
}

export function esPedidoDeSlot(valor: unknown): valor is PedidoDeSlot {
  return tieneClaves(valor, ['teamId', 'slot']) && esIdDeTeam(valor.teamId) && esSlot(valor.slot)
}

function esStat(valor: unknown): boolean {
  return (
    tieneClaves(valor, ['valorActual', 'potencial', 'bonoEstrellasIncluido', 'notas']) &&
    esEntero(valor.valorActual) &&
    esEntero(valor.potencial) &&
    esEntero(valor.bonoEstrellasIncluido) &&
    esTextoONulo(valor.notas, LARGO_MAXIMO_NOTAS_DE_STAT)
  )
}

function esConjuntoDeStats(valor: unknown): boolean {
  return (
    tieneClaves(
      valor,
      STATS.map((stat) => stat.codigo)
    ) && STATS.every((stat) => esStat(valor[stat.codigo]))
  )
}

function esMaterial(valor: unknown): boolean {
  return (
    tieneClaves(valor, ['posicion', 'nombre', 'tengo', 'necesito']) &&
    esEntero(valor.posicion) &&
    esTexto(valor.nombre, LARGO_MAXIMO_NOMBRE_CORTO) &&
    esEntero(valor.tengo) &&
    esEntero(valor.necesito)
  )
}

function esEntrenamiento(valor: unknown): boolean {
  return (
    tieneClaves(valor, [
      'estrellaActual',
      'nivelRequeridoSiguienteEtapa',
      'gananciaDespertar',
      'gananciaSeisPotenciales',
      'despertaresUsados',
      'despertaresTotal',
      'materiales'
    ]) &&
    esEntero(valor.estrellaActual) &&
    (valor.nivelRequeridoSiguienteEtapa === null || esEntero(valor.nivelRequeridoSiguienteEtapa)) &&
    esEntero(valor.gananciaDespertar) &&
    esEntero(valor.gananciaSeisPotenciales) &&
    esEntero(valor.despertaresUsados) &&
    esEntero(valor.despertaresTotal) &&
    Array.isArray(valor.materiales) &&
    valor.materiales.every(esMaterial)
  )
}

function esObjeto(valor: unknown): boolean {
  return (
    tieneClaves(valor, [
      'posicion',
      'nombre',
      'rareza',
      'nivel',
      'contrato',
      'efectoNucleoNotas'
    ]) &&
    esCodigoDe(POSICIONES_DE_OBJETO, valor.posicion) &&
    esTexto(valor.nombre, LARGO_MAXIMO_NOMBRE_CORTO) &&
    esCodigoDe(RAREZAS, valor.rareza) &&
    esEntero(valor.nivel) &&
    typeof valor.contrato === 'boolean' &&
    esTextoONulo(valor.efectoNucleoNotas, LARGO_MAXIMO_EFECTO_NUCLEO)
  )
}

export function esFichaEntrada(valor: unknown): valor is FichaEntrada {
  return (
    tieneClaves(valor, [
      'nombre',
      'elemento',
      'rol',
      'potencialInnato',
      'personalidad',
      'nivel',
      'cp',
      'stats',
      'entrenamiento',
      'objetos',
      'notasHabilidades',
      'notas'
    ]) &&
    esTexto(valor.nombre, LARGO_MAXIMO_NOMBRE_CORTO) &&
    esCatalogoONulo(ELEMENTOS, valor.elemento) &&
    esCatalogoONulo(ROLES, valor.rol) &&
    esCatalogoONulo(POTENCIALES_INNATOS, valor.potencialInnato) &&
    (valor.personalidad === null ||
      (typeof valor.personalidad === 'string' && PATRON_DE_PERSONALIDAD.test(valor.personalidad))) &&
    esEntero(valor.nivel) &&
    esEntero(valor.cp) &&
    esConjuntoDeStats(valor.stats) &&
    esEntrenamiento(valor.entrenamiento) &&
    Array.isArray(valor.objetos) &&
    valor.objetos.every(esObjeto) &&
    esTextoONulo(valor.notasHabilidades, LARGO_MAXIMO_NOTAS) &&
    esTextoONulo(valor.notas, LARGO_MAXIMO_NOTAS)
  )
}

export function esPedidoGuardarFicha(valor: unknown): valor is PedidoGuardarFicha {
  return (
    tieneClaves(valor, ['teamId', 'slot', 'ficha']) &&
    esIdDeTeam(valor.teamId) &&
    esSlot(valor.slot) &&
    esFichaEntrada(valor.ficha)
  )
}

function esImagenValida(tipo: unknown, datos: unknown): boolean {
  return (
    typeof tipo === 'string' &&
    (TIPOS_DE_IMAGEN as readonly string[]).includes(tipo) &&
    datos instanceof Uint8Array &&
    datos.byteLength >= 1 &&
    datos.byteLength <= TAMANO_MAXIMO_DE_IMAGEN
  )
}

export function validarPedidoDeImagen(valor: unknown): ClasificacionDePedidoDeImagen {
  if (!tieneClaves(valor, ['teamId', 'slot', 'tipo', 'datos'])) {
    return 'datos-invalidos'
  }
  if (!esIdDeTeam(valor.teamId) || !esSlot(valor.slot)) {
    return 'datos-invalidos'
  }
  return esImagenValida(valor.tipo, valor.datos) ? 'valido' : 'imagen-invalida'
}
