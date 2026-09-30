import {
  ELEMENTOS,
  esCodigoDe,
  POTENCIALES_INNATOS,
  RAREZAS,
  ROLES,
  STATS,
  type CodigoDeStat
} from '../../../../shared/catalogos'
import {
  LARGO_MAXIMO_EFECTO_NUCLEO,
  LARGO_MAXIMO_NOMBRE_CORTO,
  LARGO_MAXIMO_NOTAS,
  LARGO_MAXIMO_NOTAS_DE_STAT,
  type Entrenamiento,
  type FichaEntrada,
  type Material,
  type Objeto,
  type ValoresDeStat
} from '../../../../shared/teams'
import {
  contratoHabilitado,
  enteroDeTexto,
  POSICIONES_DE_OBJETO_EN_ORDEN,
  type FormularioDeFicha
} from './formulario'

export type ErroresDeFicha = Readonly<Record<string, string>>

export interface FilasUsadas {
  readonly materiales: readonly number[]
  readonly objetos: readonly number[]
}

export type ResultadoDeConversion =
  | { readonly ok: true; readonly ficha: FichaEntrada; readonly filas: FilasUsadas }
  | { readonly ok: false; readonly errores: ErroresDeFicha }

const TOPE_GRANDE = 9_999_999
const TOPE_DE_GANANCIAS = 9_999
const POTENCIAL_MAXIMO = 20

export const MENSAJE_DE_NOMBRE = `El nombre debe tener entre 1 y ${LARGO_MAXIMO_NOMBRE_CORTO} caracteres`
export const MENSAJE_DE_POTENCIAL = `El potencial debe estar entre 0 y ${POTENCIAL_MAXIMO}`
export const MENSAJE_DE_PERSONALIDAD = 'Completá las cuatro letras o dejá todas vacías'
export const MENSAJE_DE_DESPERTARES = 'No pueden superar los despertares totales'
export const MENSAJE_DE_CAMPO_DEL_BACKEND = 'Valor no válido'

const CLAVE_DE_CAMPO = new RegExp(
  '^(nombre|elemento|rol|potencial_innato|personalidad|nivel|cp|notas|notas_habilidades|' +
    `stats\\.(${STATS.map((s) => s.codigo).join('|')})\\.(valor_actual|potencial|bono_estrellas_incluido|notas)|` +
    'entrenamiento\\.(estrella_actual|nivel_requerido_siguiente_etapa|ganancia_despertar|' +
    'ganancia_seis_potenciales|despertares_total|despertares_usados)|' +
    'entrenamiento\\.materiales\\.\\d+\\.(nombre|tengo|necesito)|' +
    'objetos\\.\\d+\\.(nombre|rareza|nivel|contrato|efecto_nucleo_notas))$'
)

function mensajeDeRango(minimo: number, maximo: number): string {
  return `Debe ser un número entero entre ${minimo} y ${maximo}`
}

class Recolector {
  readonly errores: Record<string, string> = {}

  entero(clave: string, texto: string, minimo: number, maximo: number, mensaje?: string): number {
    const valor = enteroDeTexto(texto)
    if (valor === null || valor < minimo || valor > maximo) {
      this.errores[clave] = mensaje ?? mensajeDeRango(minimo, maximo)
      return minimo
    }
    return valor
  }

  enteroOpcional(clave: string, texto: string, minimo: number, maximo: number): number | null {
    return texto.trim() === '' ? null : this.entero(clave, texto, minimo, maximo)
  }

  nombre(clave: string, texto: string): string {
    const limpio = texto.trim()
    if (limpio.length < 1 || limpio.length > LARGO_MAXIMO_NOMBRE_CORTO) {
      this.errores[clave] = MENSAJE_DE_NOMBRE
    }
    return limpio
  }

  textoOpcional(clave: string, texto: string, maximo: number): string | null {
    if (texto.length > maximo) {
      this.errores[clave] = `Máximo ${maximo} caracteres`
    }
    return texto.trim() === '' ? null : texto
  }

  catalogo<T extends string>(
    catalogo: readonly { readonly codigo: T }[],
    clave: string,
    texto: string
  ): T | null {
    if (texto === '') {
      return null
    }
    if (!esCodigoDe(catalogo, texto)) {
      this.errores[clave] = MENSAJE_DE_CAMPO_DEL_BACKEND
      return null
    }
    return texto as T
  }
}

function convertirStats(
  formulario: FormularioDeFicha,
  r: Recolector
): Record<CodigoDeStat, ValoresDeStat> {
  const stats = {} as Record<CodigoDeStat, ValoresDeStat>
  for (const { codigo } of STATS) {
    const stat = formulario.stats[codigo]
    const prefijo = `stats.${codigo}`
    stats[codigo] = {
      valorActual: r.entero(`${prefijo}.valor_actual`, stat.valorActual, 0, TOPE_GRANDE),
      potencial: r.entero(
        `${prefijo}.potencial`,
        stat.potencial,
        0,
        POTENCIAL_MAXIMO,
        MENSAJE_DE_POTENCIAL
      ),
      bonoEstrellasIncluido: r.entero(
        `${prefijo}.bono_estrellas_incluido`,
        stat.bonoEstrellasIncluido,
        0,
        TOPE_GRANDE
      ),
      notas: r.textoOpcional(`${prefijo}.notas`, stat.notas, LARGO_MAXIMO_NOTAS_DE_STAT)
    }
  }
  return stats
}

function convertirEntrenamiento(
  formulario: FormularioDeFicha,
  r: Recolector
): { entrenamiento: Entrenamiento; filas: readonly number[] } {
  const usados = r.entero(
    'entrenamiento.despertares_usados',
    formulario.despertaresUsados,
    0,
    TOPE_DE_GANANCIAS
  )
  const total = r.entero(
    'entrenamiento.despertares_total',
    formulario.despertaresTotal,
    0,
    TOPE_DE_GANANCIAS
  )
  if (
    usados > total &&
    !('entrenamiento.despertares_usados' in r.errores) &&
    !('entrenamiento.despertares_total' in r.errores)
  ) {
    r.errores['entrenamiento.despertares_usados'] = MENSAJE_DE_DESPERTARES
  }
  const materiales: Material[] = []
  const filas: number[] = []
  formulario.materiales.forEach((fila, indice) => {
    if (fila.nombre.trim() === '') {
      return
    }
    const prefijo = `entrenamiento.materiales.${indice}`
    materiales.push({
      posicion: indice + 1,
      nombre: r.nombre(`${prefijo}.nombre`, fila.nombre),
      tengo: r.entero(`${prefijo}.tengo`, fila.tengo, 0, TOPE_GRANDE),
      necesito: r.entero(`${prefijo}.necesito`, fila.necesito, 0, TOPE_GRANDE)
    })
    filas.push(indice)
  })
  return {
    entrenamiento: {
      estrellaActual: r.entero('entrenamiento.estrella_actual', formulario.estrellaActual, 0, 99),
      nivelRequeridoSiguienteEtapa: r.enteroOpcional(
        'entrenamiento.nivel_requerido_siguiente_etapa',
        formulario.nivelRequeridoSiguienteEtapa,
        1,
        999
      ),
      gananciaDespertar: r.entero(
        'entrenamiento.ganancia_despertar',
        formulario.gananciaDespertar,
        0,
        TOPE_DE_GANANCIAS
      ),
      gananciaSeisPotenciales: r.entero(
        'entrenamiento.ganancia_seis_potenciales',
        formulario.gananciaSeisPotenciales,
        0,
        TOPE_DE_GANANCIAS
      ),
      despertaresUsados: usados,
      despertaresTotal: total,
      materiales
    },
    filas
  }
}

function convertirObjetos(
  formulario: FormularioDeFicha,
  r: Recolector
): { objetos: Objeto[]; filas: number[] } {
  const objetos: Objeto[] = []
  const filas: number[] = []
  formulario.objetos.forEach((fila, indice) => {
    if (fila.nombre.trim() === '') {
      return
    }
    const prefijo = `objetos.${indice}`
    const rareza = r.catalogo(RAREZAS, `${prefijo}.rareza`, fila.rareza)
    objetos.push({
      posicion: POSICIONES_DE_OBJETO_EN_ORDEN[indice] ?? 'equipado',
      nombre: r.nombre(`${prefijo}.nombre`, fila.nombre),
      rareza: rareza ?? 'rara',
      nivel: r.entero(`${prefijo}.nivel`, fila.nivel, 1, 99),
      contrato: contratoHabilitado(fila) && fila.contrato,
      efectoNucleoNotas: r.textoOpcional(
        `${prefijo}.efecto_nucleo_notas`,
        fila.efectoNucleoNotas,
        LARGO_MAXIMO_EFECTO_NUCLEO
      )
    })
    filas.push(indice)
  })
  return { objetos, filas }
}

function convertirPersonalidad(formulario: FormularioDeFicha, r: Recolector): string | null {
  const letras = formulario.personalidad
  const completas = letras.filter((letra) => letra !== '').length
  if (completas === 0) {
    return null
  }
  if (completas < letras.length) {
    r.errores.personalidad = MENSAJE_DE_PERSONALIDAD
    return null
  }
  return letras.join('')
}

export function convertirFormulario(formulario: FormularioDeFicha): ResultadoDeConversion {
  const r = new Recolector()
  const { entrenamiento, filas: filasDeMateriales } = convertirEntrenamiento(formulario, r)
  const { objetos, filas: filasDeObjetos } = convertirObjetos(formulario, r)
  const ficha: FichaEntrada = {
    nombre: r.nombre('nombre', formulario.nombre),
    elemento: r.catalogo(ELEMENTOS, 'elemento', formulario.elemento),
    rol: r.catalogo(ROLES, 'rol', formulario.rol),
    potencialInnato: r.catalogo(POTENCIALES_INNATOS, 'potencial_innato', formulario.potencialInnato),
    personalidad: convertirPersonalidad(formulario, r),
    nivel: r.entero('nivel', formulario.nivel, 1, 999),
    cp: r.entero('cp', formulario.cp, 0, TOPE_GRANDE),
    stats: convertirStats(formulario, r),
    entrenamiento,
    objetos,
    notasHabilidades: r.textoOpcional(
      'notas_habilidades',
      formulario.notasHabilidades,
      LARGO_MAXIMO_NOTAS
    ),
    notas: r.textoOpcional('notas', formulario.notas, LARGO_MAXIMO_NOTAS)
  }
  if (Object.keys(r.errores).length > 0) {
    return { ok: false, errores: r.errores }
  }
  return { ok: true, ficha, filas: { materiales: filasDeMateriales, objetos: filasDeObjetos } }
}

export interface ErroresDelBackend {
  readonly errores: ErroresDeFicha
  readonly sinCampo: boolean
}

// Los indices de materiales y objetos del backend cuentan solo las filas enviadas.
export function traducirCamposDelBackend(
  campos: readonly string[],
  filas: FilasUsadas
): ErroresDelBackend {
  const errores: Record<string, string> = {}
  let sinCampo = campos.length === 0
  for (const campo of campos) {
    const coincidencia = /^(entrenamiento\.materiales|objetos)\.(\d+)\.(.+)$/.exec(campo)
    let clave = campo
    if (coincidencia !== null) {
      const [, lista, indice, resto] = coincidencia
      const tabla = lista === 'objetos' ? filas.objetos : filas.materiales
      const fila = tabla[Number(indice)]
      clave = fila === undefined ? campo : `${lista}.${fila}.${resto}`
    }
    if (CLAVE_DE_CAMPO.test(clave)) {
      errores[clave] = MENSAJE_DE_CAMPO_DEL_BACKEND
    } else {
      sinCampo = true
    }
  }
  return { errores, sinCampo }
}
