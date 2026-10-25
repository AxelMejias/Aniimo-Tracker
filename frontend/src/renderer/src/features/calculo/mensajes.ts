import type {
  CodigoDeErrorDeCalculo,
  MotivoDeSugerencia,
  NotaDeObjeto,
  TerminoDeDesglose
} from '../../../../shared/calculo'
import {
  MENSAJE_ERROR_INESPERADO,
  MENSAJE_SESION_VENCIDA,
  MENSAJE_SIN_CONEXION
} from '../../shared/mensajes'

export const TEXTO_DE_DATOS_DE_EJEMPLO =
  'Datos de ejemplo: estos números son inventados y no sirven para el juego real.'

export const TEXTO_DE_ESTIMACION_SIN_VERIFICAR =
  'Estimación sin verificar: los valores finales y el CP no están confirmados en el juego.'

export const MENSAJE_SIN_ESPECIE = 'Elegí una especie del catálogo para calcular'

export const MENSAJE_DESACTUALIZADA = 'La sugerencia está desactualizada: volvé a calcular.'

export function mensajeDeErrorDeCalculo(error: CodigoDeErrorDeCalculo): string {
  switch (error) {
    case 'no-disponible':
      return 'El cálculo no está disponible: el catálogo de crecimiento es inválido'
    case 'sin-conexion':
      return MENSAJE_SIN_CONEXION
    case 'especie-desconocida':
      return 'La especie elegida no está en el catálogo'
    case 'datos-invalidos':
      return 'Revisá los datos de la ficha para calcular'
    case 'sesion-vencida':
      return MENSAJE_SESION_VENCIDA
    case 'credenciales-invalidas':
    case 'nombre-no-disponible':
    case 'demasiados-intentos':
    case 'error-inesperado':
      return MENSAJE_ERROR_INESPERADO
  }
}

export function textoDeMotivo(motivo: MotivoDeSugerencia | null): string {
  switch (motivo) {
    case 'fuera-de-rango':
      return 'fuera del rango medido'
    case 'nivel-no-medido':
      return 'nivel no medido'
    case 'resultado-invalido':
      return 'resultado inválido'
    case 'stats-incompletos':
      return 'stats incompletos'
    case 'sin-datos':
    case null:
      return 'sin datos'
  }
}

function textoDeNota(nota: NotaDeObjeto): string {
  switch (nota) {
    case 'sin-elegir':
      return 'no elegiste un objeto del catálogo'
    case 'objeto-desconocido':
      return 'no está en el catálogo'
    case 'nivel-de-objeto-sin-datos':
      return 'no hay datos para su nivel'
    case 'alternativo-no-suma':
      return 'el alternativo no suma'
  }
}

export function notaDeObjetoNoAplicado(posicion: string, nota: NotaDeObjeto | null): string {
  const motivo = nota === null ? 'sin datos' : textoDeNota(nota)
  return `El objeto ${posicion} no se tuvo en cuenta: ${motivo}.`
}

function conSigno(valor: number): string {
  return valor > 0 ? `+${valor}` : String(valor)
}

export function textoDeDiferencia(diferencia: number | null): string {
  return diferencia === null ? '—' : conSigno(diferencia)
}

export function textoDeTermino(termino: TerminoDeDesglose): string {
  const valor =
    termino.tipo === 'base'
      ? String(termino.valor)
      : termino.tipo === 'porcentaje'
        ? `${conSigno(termino.valor)}%`
        : conSigno(termino.valor)
  return `${termino.origen}: ${termino.detalle} (${valor})`
}
