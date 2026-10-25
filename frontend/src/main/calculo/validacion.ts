import {
  PATRON_DE_ID_DE_CATALOGO,
  type PedidoCalcular,
  type PedidoPotencial
} from '../../shared/calculo'
import {
  esCodigoDe,
  PATRON_DE_PERSONALIDAD,
  POSICIONES_DE_OBJETO,
  STATS
} from '../../shared/catalogos'
import { esEtapaDeEstrella, esFechaDeParche } from '../../shared/parche'
import { tieneClaves } from '../teams/validacion'

const MAXIMO_DE_OBJETOS = 2

function esEnteroEntre(valor: unknown, minimo: number, maximo: number): boolean {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= minimo && valor <= maximo
}

function esIdDeCatalogo(valor: unknown): boolean {
  return typeof valor === 'string' && PATRON_DE_ID_DE_CATALOGO.test(valor)
}

function esPersonalidadONula(valor: unknown): boolean {
  return valor === null || (typeof valor === 'string' && PATRON_DE_PERSONALIDAD.test(valor))
}

function sonPotenciales(valor: unknown): boolean {
  return (
    tieneClaves(
      valor,
      STATS.map((stat) => stat.codigo)
    ) && STATS.every((stat) => esEnteroEntre(valor[stat.codigo], 0, 20))
  )
}

function esObjeto(valor: unknown): valor is { posicion: string } {
  return (
    tieneClaves(valor, ['posicion', 'objetoId', 'nivel']) &&
    esCodigoDe(POSICIONES_DE_OBJETO, valor.posicion) &&
    (valor.objetoId === null || esIdDeCatalogo(valor.objetoId)) &&
    esEnteroEntre(valor.nivel, 1, 99)
  )
}

function sonObjetos(valor: unknown): boolean {
  if (!Array.isArray(valor) || valor.length > MAXIMO_DE_OBJETOS || !valor.every(esObjeto)) {
    return false
  }
  const posiciones = valor.map((objeto: { posicion: string }) => objeto.posicion)
  return new Set(posiciones).size === posiciones.length
}

export function esPedidoCalcular(valor: unknown): valor is PedidoCalcular {
  return (
    tieneClaves(valor, [
      'especieId',
      'nivel',
      'potenciales',
      'etapaEstrella',
      'personalidad',
      'objetos'
    ]) &&
    esIdDeCatalogo(valor.especieId) &&
    esEnteroEntre(valor.nivel, 1, 999) &&
    sonPotenciales(valor.potenciales) &&
    esEtapaDeEstrella(valor.etapaEstrella) &&
    esPersonalidadONula(valor.personalidad) &&
    sonObjetos(valor.objetos)
  )
}

function esObjetoEquipado(valor: unknown): boolean {
  return (
    tieneClaves(valor, ['objetoId', 'nivel']) &&
    (valor.objetoId === null || esIdDeCatalogo(valor.objetoId)) &&
    esEnteroEntre(valor.nivel, 1, 99)
  )
}

export function esPedidoPotencial(valor: unknown): valor is PedidoPotencial {
  return (
    tieneClaves(valor, [
      'nivel',
      'etapaEstrella',
      'potenciales',
      'personalidad',
      'objetoEquipado',
      'despertaresUsados',
      'despertaresTotal',
      'fechaParche'
    ]) &&
    esEnteroEntre(valor.nivel, 1, 999) &&
    esEtapaDeEstrella(valor.etapaEstrella) &&
    sonPotenciales(valor.potenciales) &&
    esPersonalidadONula(valor.personalidad) &&
    (valor.objetoEquipado === null || esObjetoEquipado(valor.objetoEquipado)) &&
    esEnteroEntre(valor.despertaresUsados, 0, 9999) &&
    esEnteroEntre(valor.despertaresTotal, 0, 9999) &&
    (valor.despertaresUsados as number) <= (valor.despertaresTotal as number) &&
    (valor.fechaParche === null || esFechaDeParche(valor.fechaParche))
  )
}
