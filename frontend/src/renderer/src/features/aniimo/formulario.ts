import { STATS, type CodigoDeStat } from '../../../../shared/catalogos'
import type { Ficha, FichaEntrada } from '../../../../shared/teams'

export interface FormularioDeStat {
  readonly valorActual: string
  readonly potencial: string
  readonly bonoEstrellasIncluido: string
  readonly notas: string
}

export interface FormularioDeMaterial {
  readonly nombre: string
  readonly tengo: string
  readonly necesito: string
}

export interface FormularioDeObjeto {
  readonly nombre: string
  readonly rareza: string
  readonly nivel: string
  readonly contrato: boolean
  readonly efectoNucleoNotas: string
}

export interface FormularioDeFicha {
  readonly nombre: string
  readonly elemento: string
  readonly rol: string
  readonly potencialInnato: string
  readonly personalidad: readonly [string, string, string, string]
  readonly nivel: string
  readonly cp: string
  readonly stats: Readonly<Record<CodigoDeStat, FormularioDeStat>>
  readonly estrellaActual: string
  readonly nivelRequeridoSiguienteEtapa: string
  readonly gananciaDespertar: string
  readonly gananciaSeisPotenciales: string
  readonly despertaresUsados: string
  readonly despertaresTotal: string
  readonly materiales: readonly FormularioDeMaterial[]
  readonly objetos: readonly FormularioDeObjeto[]
  readonly notasHabilidades: string
  readonly notas: string
}

export const CANTIDAD_DE_MATERIALES = 3
export const POSICIONES_DE_OBJETO_EN_ORDEN = ['equipado', 'alternativo'] as const

const CONTRATO_RAREZA = 'legendaria'
const CONTRATO_NIVEL = 15

const MATERIAL_VACIO: FormularioDeMaterial = { nombre: '', tengo: '0', necesito: '0' }

function objetoVacio(): FormularioDeObjeto {
  return { nombre: '', rareza: 'rara', nivel: '1', contrato: false, efectoNucleoNotas: '' }
}

const STAT_VACIO: FormularioDeStat = {
  valorActual: '0',
  potencial: '0',
  bonoEstrellasIncluido: '0',
  notas: ''
}

export function formularioVacio(): FormularioDeFicha {
  return {
    nombre: '',
    elemento: '',
    rol: '',
    potencialInnato: '',
    personalidad: ['', '', '', ''],
    nivel: '1',
    cp: '0',
    stats: Object.fromEntries(STATS.map(({ codigo }) => [codigo, STAT_VACIO])) as Record<
      CodigoDeStat,
      FormularioDeStat
    >,
    estrellaActual: '0',
    nivelRequeridoSiguienteEtapa: '',
    gananciaDespertar: '0',
    gananciaSeisPotenciales: '0',
    despertaresUsados: '0',
    despertaresTotal: '0',
    materiales: Array.from({ length: CANTIDAD_DE_MATERIALES }, () => MATERIAL_VACIO),
    objetos: POSICIONES_DE_OBJETO_EN_ORDEN.map(objetoVacio),
    notasHabilidades: '',
    notas: ''
  }
}

export function formularioDeFicha(ficha: Ficha | FichaEntrada): FormularioDeFicha {
  const base = formularioVacio()
  const letras = (ficha.personalidad ?? '').split('')
  const materiales = base.materiales.map((vacio, indice) => {
    const material = ficha.entrenamiento.materiales.find((m) => m.posicion === indice + 1)
    return material === undefined
      ? vacio
      : {
          nombre: material.nombre,
          tengo: String(material.tengo),
          necesito: String(material.necesito)
        }
  })
  const objetos = POSICIONES_DE_OBJETO_EN_ORDEN.map((posicion) => {
    const objeto = ficha.objetos.find((o) => o.posicion === posicion)
    return objeto === undefined
      ? objetoVacio()
      : {
          nombre: objeto.nombre,
          rareza: objeto.rareza,
          nivel: String(objeto.nivel),
          contrato: objeto.contrato,
          efectoNucleoNotas: objeto.efectoNucleoNotas ?? ''
        }
  })
  return {
    nombre: ficha.nombre,
    elemento: ficha.elemento ?? '',
    rol: ficha.rol ?? '',
    potencialInnato: ficha.potencialInnato ?? '',
    personalidad: [letras[0] ?? '', letras[1] ?? '', letras[2] ?? '', letras[3] ?? ''],
    nivel: String(ficha.nivel),
    cp: String(ficha.cp),
    stats: Object.fromEntries(
      STATS.map(({ codigo }) => {
        const stat = ficha.stats[codigo]
        return [
          codigo,
          {
            valorActual: String(stat.valorActual),
            potencial: String(stat.potencial),
            bonoEstrellasIncluido: String(stat.bonoEstrellasIncluido),
            notas: stat.notas ?? ''
          }
        ]
      })
    ) as Record<CodigoDeStat, FormularioDeStat>,
    estrellaActual: String(ficha.entrenamiento.estrellaActual),
    nivelRequeridoSiguienteEtapa:
      ficha.entrenamiento.nivelRequeridoSiguienteEtapa === null
        ? ''
        : String(ficha.entrenamiento.nivelRequeridoSiguienteEtapa),
    gananciaDespertar: String(ficha.entrenamiento.gananciaDespertar),
    gananciaSeisPotenciales: String(ficha.entrenamiento.gananciaSeisPotenciales),
    despertaresUsados: String(ficha.entrenamiento.despertaresUsados),
    despertaresTotal: String(ficha.entrenamiento.despertaresTotal),
    materiales,
    objetos,
    notasHabilidades: ficha.notasHabilidades ?? '',
    notas: ficha.notas ?? ''
  }
}

export function enteroDeTexto(texto: string): number | null {
  const limpio = texto.trim()
  return /^\d+$/.test(limpio) ? Number(limpio) : null
}

export function contratoHabilitado(objeto: FormularioDeObjeto): boolean {
  return objeto.rareza === CONTRATO_RAREZA && enteroDeTexto(objeto.nivel) === CONTRATO_NIVEL
}

export function despertaresRestantes(formulario: FormularioDeFicha): number | null {
  const usados = enteroDeTexto(formulario.despertaresUsados)
  const total = enteroDeTexto(formulario.despertaresTotal)
  return usados === null || total === null || usados > total ? null : total - usados
}

export type EstadoDeMaterial = { readonly completo: true } | { readonly faltan: number } | null

export function estadoDeMaterial(material: FormularioDeMaterial): EstadoDeMaterial {
  const tengo = enteroDeTexto(material.tengo)
  const necesito = enteroDeTexto(material.necesito)
  if (tengo === null || necesito === null) {
    return null
  }
  return tengo >= necesito ? { completo: true } : { faltan: necesito - tengo }
}
