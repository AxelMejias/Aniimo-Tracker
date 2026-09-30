import {
  ELEMENTOS,
  esCodigoDe,
  POSICIONES_DE_OBJETO,
  POTENCIALES_INNATOS,
  RAREZAS,
  ROLES,
  STATS,
  type CodigoDeStat
} from '../../shared/catalogos'
import type {
  Entrenamiento,
  Ficha,
  FichaEntrada,
  Material,
  Objeto,
  ResumenDeAniimo,
  SlotDeTeam,
  TeamResumen,
  ValoresDeStat
} from '../../shared/teams'
import { esObjetoPlano } from '../auth/validacion'

export class RespuestaInvalida extends Error {
  constructor() {
    super('Respuesta del backend con forma inesperada')
  }
}

type Registro = Record<string, unknown>

function registro(valor: unknown): Registro {
  if (!esObjetoPlano(valor)) {
    throw new RespuestaInvalida()
  }
  return valor
}

function lista(valor: unknown): unknown[] {
  if (!Array.isArray(valor)) {
    throw new RespuestaInvalida()
  }
  return valor
}

function entero(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor)) {
    throw new RespuestaInvalida()
  }
  return valor
}

function enteroONulo(valor: unknown): number | null {
  return valor === null ? null : entero(valor)
}

function texto(valor: unknown): string {
  if (typeof valor !== 'string') {
    throw new RespuestaInvalida()
  }
  return valor
}

function textoONulo(valor: unknown): string | null {
  return valor === null ? null : texto(valor)
}

function booleano(valor: unknown): boolean {
  if (typeof valor !== 'boolean') {
    throw new RespuestaInvalida()
  }
  return valor
}

function codigo<T extends string>(catalogo: readonly { readonly codigo: T }[], valor: unknown): T {
  if (!esCodigoDe(catalogo, valor)) {
    throw new RespuestaInvalida()
  }
  return valor as T
}

function codigoONulo<T extends string>(
  catalogo: readonly { readonly codigo: T }[],
  valor: unknown
): T | null {
  return valor === null ? null : codigo(catalogo, valor)
}

function statAApi(stat: ValoresDeStat): Registro {
  return {
    valor_actual: stat.valorActual,
    potencial: stat.potencial,
    bono_estrellas_incluido: stat.bonoEstrellasIncluido,
    notas: stat.notas
  }
}

export function fichaAApi(ficha: FichaEntrada): Registro {
  const { entrenamiento } = ficha
  return {
    nombre: ficha.nombre,
    elemento: ficha.elemento,
    rol: ficha.rol,
    potencial_innato: ficha.potencialInnato,
    personalidad: ficha.personalidad,
    nivel: ficha.nivel,
    cp: ficha.cp,
    stats: Object.fromEntries(STATS.map(({ codigo: c }) => [c, statAApi(ficha.stats[c])])),
    entrenamiento: {
      estrella_actual: entrenamiento.estrellaActual,
      nivel_requerido_siguiente_etapa: entrenamiento.nivelRequeridoSiguienteEtapa,
      ganancia_despertar: entrenamiento.gananciaDespertar,
      ganancia_seis_potenciales: entrenamiento.gananciaSeisPotenciales,
      despertares_total: entrenamiento.despertaresTotal,
      despertares_usados: entrenamiento.despertaresUsados,
      materiales: entrenamiento.materiales.map((m) => ({
        posicion: m.posicion,
        nombre: m.nombre,
        tengo: m.tengo,
        necesito: m.necesito
      }))
    },
    objetos: ficha.objetos.map((o) => ({
      posicion: o.posicion,
      nombre: o.nombre,
      rareza: o.rareza,
      nivel: o.nivel,
      contrato: o.contrato,
      efecto_nucleo_notas: o.efectoNucleoNotas
    })),
    notas_habilidades: ficha.notasHabilidades,
    notas: ficha.notas
  }
}

function statDeApi(valor: unknown): ValoresDeStat {
  const stat = registro(valor)
  return {
    valorActual: entero(stat.valor_actual),
    potencial: entero(stat.potencial),
    bonoEstrellasIncluido: entero(stat.bono_estrellas_incluido),
    notas: textoONulo(stat.notas)
  }
}

function materialDeApi(valor: unknown): Material {
  const material = registro(valor)
  return {
    posicion: entero(material.posicion),
    nombre: texto(material.nombre),
    tengo: entero(material.tengo),
    necesito: entero(material.necesito)
  }
}

function entrenamientoDeApi(valor: unknown): Entrenamiento {
  const e = registro(valor)
  return {
    estrellaActual: entero(e.estrella_actual),
    nivelRequeridoSiguienteEtapa: enteroONulo(e.nivel_requerido_siguiente_etapa),
    gananciaDespertar: entero(e.ganancia_despertar),
    gananciaSeisPotenciales: entero(e.ganancia_seis_potenciales),
    despertaresUsados: entero(e.despertares_usados),
    despertaresTotal: entero(e.despertares_total),
    materiales: lista(e.materiales).map(materialDeApi)
  }
}

function objetoDeApi(valor: unknown): Objeto {
  const o = registro(valor)
  return {
    posicion: codigo(POSICIONES_DE_OBJETO, o.posicion),
    nombre: texto(o.nombre),
    rareza: codigo(RAREZAS, o.rareza),
    nivel: entero(o.nivel),
    contrato: booleano(o.contrato),
    efectoNucleoNotas: textoONulo(o.efecto_nucleo_notas)
  }
}

export function fichaDeApi(valor: unknown): Ficha {
  const f = registro(valor)
  const stats = registro(f.stats)
  return {
    slot: entero(f.slot),
    tieneImagen: booleano(f.tiene_imagen),
    nombre: texto(f.nombre),
    elemento: codigoONulo(ELEMENTOS, f.elemento),
    rol: codigoONulo(ROLES, f.rol),
    potencialInnato: codigoONulo(POTENCIALES_INNATOS, f.potencial_innato),
    personalidad: textoONulo(f.personalidad),
    nivel: entero(f.nivel),
    cp: entero(f.cp),
    stats: Object.fromEntries(
      STATS.map(({ codigo: c }) => [c, statDeApi(stats[c])])
    ) as Record<CodigoDeStat, ValoresDeStat>,
    entrenamiento: entrenamientoDeApi(f.entrenamiento),
    objetos: lista(f.objetos).map(objetoDeApi),
    notasHabilidades: textoONulo(f.notas_habilidades),
    notas: textoONulo(f.notas)
  }
}

function resumenDeApi(valor: unknown): ResumenDeAniimo {
  const r = registro(valor)
  return {
    nombre: texto(r.nombre),
    nivel: entero(r.nivel),
    cp: entero(r.cp),
    personalidad: textoONulo(r.personalidad),
    estrellaActual: entero(r.estrella_actual),
    despertaresUsados: entero(r.despertares_usados),
    despertaresTotal: entero(r.despertares_total),
    tieneImagen: booleano(r.tiene_imagen)
  }
}

function slotDeApi(valor: unknown): SlotDeTeam {
  const s = registro(valor)
  return { slot: entero(s.slot), aniimo: s.aniimo === null ? null : resumenDeApi(s.aniimo) }
}

export function teamDeApi(valor: unknown): TeamResumen {
  const t = registro(valor)
  return {
    id: texto(t.id),
    nombre: texto(t.nombre),
    orden: entero(t.orden),
    slots: lista(t.slots).map(slotDeApi)
  }
}

export function listaDeTeamsDeApi(valor: unknown): TeamResumen[] {
  return lista(registro(valor).teams).map(teamDeApi)
}

export function camposDeValidacion(cuerpo: unknown): string[] {
  const detalle = esObjetoPlano(cuerpo) ? cuerpo.detail : undefined
  if (!Array.isArray(detalle)) {
    return []
  }
  const campos = new Set<string>()
  for (const item of detalle) {
    const loc = esObjetoPlano(item) ? item.loc : undefined
    if (Array.isArray(loc) && loc[0] === 'body' && loc.length > 1) {
      campos.add(loc.slice(1).map(String).join('.'))
    }
  }
  return [...campos]
}
