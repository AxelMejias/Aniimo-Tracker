import {
  ELEMENTOS,
  POSICIONES_DE_OBJETO,
  POTENCIALES_INNATOS,
  RAREZAS,
  ROLES,
  STATS
} from '../../../../shared/catalogos'
import type { FichaBase, Objeto, ResumenDeAniimo, SlotDeTeam } from '../../../../shared/teams'

export type Mayor = 'izquierda' | 'derecha' | 'igual'

export interface FilaDeTexto {
  readonly tipo: 'texto'
  readonly clave: string
  readonly etiqueta: string
  readonly izquierda: string | null
  readonly derecha: string | null
}

export interface FilaNumerica {
  readonly tipo: 'numero'
  readonly clave: string
  readonly etiqueta: string
  readonly izquierda: number | null
  readonly derecha: number | null
  readonly diferencia: number | null
  readonly mayor: Mayor | null
}

export type FilaDeComparacion = FilaDeTexto | FilaNumerica

export interface ParDeSlots {
  readonly slot: number
  readonly izquierda: ResumenDeAniimo | null
  readonly derecha: ResumenDeAniimo | null
}

type Catalogo = readonly { readonly codigo: string; readonly etiqueta: string }[]

function etiquetaDe(catalogo: Catalogo, codigo: string | null): string | null {
  return catalogo.find((opcion) => opcion.codigo === codigo)?.etiqueta ?? null
}

function texto(
  clave: string,
  etiqueta: string,
  izquierda: string | null,
  derecha: string | null
): FilaDeTexto {
  return { tipo: 'texto', clave, etiqueta, izquierda, derecha }
}

function numero(
  clave: string,
  etiqueta: string,
  izquierda: number | null,
  derecha: number | null
): FilaNumerica {
  if (izquierda === null || derecha === null) {
    return { tipo: 'numero', clave, etiqueta, izquierda, derecha, diferencia: null, mayor: null }
  }
  const diferencia = derecha - izquierda
  const mayor: Mayor = diferencia === 0 ? 'igual' : diferencia > 0 ? 'derecha' : 'izquierda'
  return { tipo: 'numero', clave, etiqueta, izquierda, derecha, diferencia, mayor }
}

function descripcionDeObjeto(objeto: Objeto | undefined): string | null {
  if (objeto === undefined) {
    return null
  }
  const rareza = etiquetaDe(RAREZAS, objeto.rareza) ?? objeto.rareza
  return `${objeto.nombre} (${rareza}, nivel ${objeto.nivel})`
}

export function compararFichas(izquierda: FichaBase, derecha: FichaBase): FilaDeComparacion[] {
  const filas: FilaDeComparacion[] = [
    texto('nombre', 'Nombre', izquierda.nombre, derecha.nombre),
    texto(
      'elemento',
      'Elemento',
      etiquetaDe(ELEMENTOS, izquierda.elemento),
      etiquetaDe(ELEMENTOS, derecha.elemento)
    ),
    texto('rol', 'Rol', etiquetaDe(ROLES, izquierda.rol), etiquetaDe(ROLES, derecha.rol)),
    texto(
      'potencialInnato',
      'Potencial innato',
      etiquetaDe(POTENCIALES_INNATOS, izquierda.potencialInnato),
      etiquetaDe(POTENCIALES_INNATOS, derecha.potencialInnato)
    ),
    texto('personalidad', 'Personalidad', izquierda.personalidad, derecha.personalidad),
    numero('nivel', 'Nivel', izquierda.nivel, derecha.nivel),
    numero('cp', 'CP', izquierda.cp, derecha.cp)
  ]
  for (const { codigo, etiqueta } of STATS) {
    const i = izquierda.stats[codigo]
    const d = derecha.stats[codigo]
    filas.push(
      numero(`${codigo}.valorActual`, `${etiqueta} valor`, i.valorActual, d.valorActual),
      numero(`${codigo}.potencial`, `${etiqueta} potencial`, i.potencial, d.potencial),
      numero(
        `${codigo}.bonoEstrellasIncluido`,
        `${etiqueta} bono de estrellas`,
        i.bonoEstrellasIncluido,
        d.bonoEstrellasIncluido
      )
    )
  }
  const ei = izquierda.entrenamiento
  const ed = derecha.entrenamiento
  filas.push(
    numero('estrellaActual', 'Estrella actual', ei.estrellaActual, ed.estrellaActual),
    numero(
      'nivelRequeridoSiguienteEtapa',
      'Nivel requerido de la siguiente etapa',
      ei.nivelRequeridoSiguienteEtapa,
      ed.nivelRequeridoSiguienteEtapa
    ),
    numero('gananciaDespertar', 'Ganancia por despertar', ei.gananciaDespertar, ed.gananciaDespertar),
    numero(
      'gananciaSeisPotenciales',
      'Ganancia por seis potenciales',
      ei.gananciaSeisPotenciales,
      ed.gananciaSeisPotenciales
    ),
    numero('despertaresUsados', 'Despertares usados', ei.despertaresUsados, ed.despertaresUsados),
    numero('despertaresTotal', 'Despertares total', ei.despertaresTotal, ed.despertaresTotal)
  )
  for (const { codigo, etiqueta } of POSICIONES_DE_OBJETO) {
    filas.push(
      texto(
        `objeto.${codigo}`,
        `Objeto ${etiqueta.toLowerCase()}`,
        descripcionDeObjeto(izquierda.objetos.find((o) => o.posicion === codigo)),
        descripcionDeObjeto(derecha.objetos.find((o) => o.posicion === codigo))
      )
    )
  }
  return filas
}

function resumenDelSlot(team: { readonly slots: readonly SlotDeTeam[] }, slot: number) {
  return team.slots.find((s) => s.slot === slot)?.aniimo ?? null
}

export function compararTeams(
  izquierda: { readonly slots: readonly SlotDeTeam[] },
  derecha: { readonly slots: readonly SlotDeTeam[] }
): ParDeSlots[] {
  return [1, 2, 3, 4].map((slot) => ({
    slot,
    izquierda: resumenDelSlot(izquierda, slot),
    derecha: resumenDelSlot(derecha, slot)
  }))
}
