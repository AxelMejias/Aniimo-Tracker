import { describe, expect, it } from 'vitest'
import { fichaDeReferencia } from '../../../../../tests/fixtures/ficha'
import { STATS } from '../../../../shared/catalogos'
import type { FichaBase, SlotDeTeam } from '../../../../shared/teams'
import {
  compararFichas,
  compararTeams,
  type FilaDeComparacion,
  type FilaNumerica
} from './comparar'

function ficha(cambios: Partial<FichaBase> = {}): FichaBase {
  return { ...fichaDeReferencia(), ...cambios }
}

function fila(filas: readonly FilaDeComparacion[], clave: string): FilaDeComparacion {
  const encontrada = filas.find((f) => f.clave === clave)
  if (encontrada === undefined) {
    throw new Error(`Sin fila ${clave}`)
  }
  return encontrada
}

function numerica(filas: readonly FilaDeComparacion[], clave: string): FilaNumerica {
  const f = fila(filas, clave)
  if (f.tipo !== 'numero') {
    throw new Error(`La fila ${clave} no es numerica`)
  }
  return f
}

describe('compararFichas: numericos', () => {
  it('mayor a la derecha con diferencia derecha menos izquierda', () => {
    const filas = compararFichas(ficha({ cp: 3475 }), ficha({ cp: 3600 }))
    expect(numerica(filas, 'cp')).toMatchObject({
      izquierda: 3475,
      derecha: 3600,
      diferencia: 125,
      mayor: 'derecha'
    })
  })

  it('mayor a la izquierda con diferencia negativa', () => {
    const filas = compararFichas(ficha({ cp: 4000 }), ficha({ cp: 3600 }))
    expect(numerica(filas, 'cp')).toMatchObject({ diferencia: -400, mayor: 'izquierda' })
  })

  it('iguales', () => {
    const filas = compararFichas(ficha({ nivel: 60 }), ficha({ nivel: 60 }))
    expect(numerica(filas, 'nivel')).toMatchObject({ diferencia: 0, mayor: 'igual' })
  })

  it('un null en algun lado deja diferencia y mayor vacios y conserva el otro valor', () => {
    const base = fichaDeReferencia()
    const sinNivel = ficha({
      entrenamiento: { ...base.entrenamiento, nivelRequeridoSiguienteEtapa: null }
    })
    const filas = compararFichas(ficha(), sinNivel)
    expect(numerica(filas, 'nivelRequeridoSiguienteEtapa')).toMatchObject({
      izquierda: 65,
      derecha: null,
      diferencia: null,
      mayor: null
    })
    const inversa = compararFichas(sinNivel, ficha())
    expect(numerica(inversa, 'nivelRequeridoSiguienteEtapa')).toMatchObject({
      izquierda: null,
      derecha: 65,
      diferencia: null,
      mayor: null
    })
  })

  it('lista valor, potencial y bono de estrellas de los seis stats', () => {
    const base = fichaDeReferencia()
    const filas = compararFichas(
      ficha(),
      ficha({
        stats: { ...base.stats, atq: { ...base.stats.atq, valorActual: 800, potencial: 18 } }
      })
    )
    for (const { codigo } of STATS) {
      for (const campo of ['valorActual', 'potencial', 'bonoEstrellasIncluido']) {
        expect(fila(filas, `${codigo}.${campo}`).tipo).toBe('numero')
      }
    }
    expect(numerica(filas, 'atq.valorActual')).toMatchObject({
      izquierda: 723,
      derecha: 800,
      diferencia: 77,
      mayor: 'derecha'
    })
    expect(numerica(filas, 'atq.potencial')).toMatchObject({ diferencia: -2, mayor: 'izquierda' })
    expect(numerica(filas, 'ps.valorActual')).toMatchObject({ diferencia: 0, mayor: 'igual' })
  })

  it('incluye todos los campos numericos de entrenamiento', () => {
    const filas = compararFichas(ficha(), ficha())
    for (const clave of [
      'nivel',
      'cp',
      'estrellaActual',
      'nivelRequeridoSiguienteEtapa',
      'gananciaDespertar',
      'gananciaSeisPotenciales',
      'despertaresUsados',
      'despertaresTotal'
    ]) {
      expect(fila(filas, clave).tipo).toBe('numero')
    }
    expect(numerica(filas, 'despertaresUsados')).toMatchObject({ izquierda: 28, derecha: 28 })
    expect(numerica(filas, 'despertaresTotal')).toMatchObject({ izquierda: 43, derecha: 43 })
  })
})

describe('compararFichas: valores mostrados sin comparar', () => {
  it('nombre, elemento, rol, potencial innato y personalidad se muestran sin diferencia', () => {
    const filas = compararFichas(
      ficha(),
      ficha({ nombre: 'Otro', elemento: 'fuego', rol: null, personalidad: 'ISTP' })
    )
    expect(fila(filas, 'nombre')).toEqual({
      tipo: 'texto',
      clave: 'nombre',
      etiqueta: 'Nombre',
      izquierda: 'Irisalis',
      derecha: 'Otro'
    })
    expect(fila(filas, 'elemento')).toMatchObject({
      tipo: 'texto',
      izquierda: 'Hielo',
      derecha: 'Fuego'
    })
    expect(fila(filas, 'rol')).toMatchObject({ izquierda: 'Curación', derecha: null })
    expect(fila(filas, 'potencialInnato')).toMatchObject({ izquierda: 'Perfecto' })
    expect(fila(filas, 'personalidad')).toMatchObject({ izquierda: 'ENFJ', derecha: 'ISTP' })
  })

  it('los objetos se listan sin comparar', () => {
    const filas = compararFichas(ficha(), ficha({ objetos: [] }))
    expect(fila(filas, 'objeto.equipado')).toMatchObject({
      tipo: 'texto',
      izquierda: 'Corona antigua (Legendaria, nivel 15)',
      derecha: null
    })
    expect(fila(filas, 'objeto.alternativo')).toMatchObject({
      izquierda: 'Anillo simple (Rara, nivel 4)'
    })
  })
})

describe('compararFichas: sin notas ni score', () => {
  it('no incluye filas de notas, totales ni puntajes ni el texto de las notas', () => {
    const filas = compararFichas(ficha(), ficha({ cp: 1 }))
    expect(filas.some((f) => /nota/i.test(f.clave) || /nota/i.test(f.etiqueta))).toBe(false)
    expect(filas.some((f) => /puntaje|score|^total$/i.test(f.clave))).toBe(false)
    expect(JSON.stringify(filas)).not.toContain('Tope de potencial')
    expect(JSON.stringify(filas)).not.toContain('Aniimo de referencia')
    expect(JSON.stringify(filas)).not.toContain('Efecto de nucleo')
  })

  it('no incluye informacion de privacidad aunque la ficha la tenga', () => {
    const filas = compararFichas(
      { ...fichaDeReferencia(), notasPrivadas: true } as FichaBase,
      ficha()
    )
    expect(JSON.stringify(filas)).not.toMatch(/privad/i)
  })
})

describe('compararTeams', () => {
  const resumen = (nombre: string): NonNullable<SlotDeTeam['aniimo']> => ({
    nombre,
    nivel: 60,
    cp: 3475,
    personalidad: 'ENFJ',
    estrellaActual: 2,
    despertaresUsados: 28,
    despertaresTotal: 43,
    tieneImagen: false
  })
  const equipo = (...ocupados: number[]): { slots: readonly SlotDeTeam[] } => ({
    slots: [1, 2, 3, 4].map((slot) => ({
      slot,
      aniimo: ocupados.includes(slot) ? resumen(`A${slot}`) : null
    }))
  })

  it('arma cuatro pares en orden de slot', () => {
    const pares = compararTeams(equipo(1, 2), equipo(1))
    expect(pares.map((p) => p.slot)).toEqual([1, 2, 3, 4])
  })

  it('con slots dispares el par 2 tiene resumen a la izquierda y vacio a la derecha', () => {
    const pares = compararTeams(equipo(1, 2), equipo(1))
    expect(pares[0]?.izquierda?.nombre).toBe('A1')
    expect(pares[0]?.derecha?.nombre).toBe('A1')
    expect(pares[1]?.izquierda?.nombre).toBe('A2')
    expect(pares[1]?.derecha).toBeNull()
    expect(pares[2]).toMatchObject({ izquierda: null, derecha: null })
    expect(pares[3]).toMatchObject({ izquierda: null, derecha: null })
  })

  it('conserva el resumen completo y no agrega totales', () => {
    const [primero] = compararTeams(equipo(1), equipo())
    expect(primero?.izquierda).toEqual(resumen('A1'))
    expect(Object.keys(primero ?? {}).sort()).toEqual(['derecha', 'izquierda', 'slot'])
  })

  it('un team con slots desordenados se ordena por slot', () => {
    const desordenado = { slots: [...equipo(1, 3).slots].reverse() }
    const pares = compararTeams(desordenado, equipo())
    expect(pares.map((p) => p.slot)).toEqual([1, 2, 3, 4])
    expect(pares[2]?.izquierda?.nombre).toBe('A3')
  })
})
