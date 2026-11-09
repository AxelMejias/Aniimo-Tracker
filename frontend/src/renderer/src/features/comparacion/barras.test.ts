import { describe, expect, it } from 'vitest'
import { largoDeBarra, largosDeFila } from './barras'

describe('largoDeBarra', () => {
  it('es el porcentaje del valor sobre el maximo, redondeado al entero mas cercano', () => {
    expect(largoDeBarra(3475, 3600)).toBe(97)
    expect(largoDeBarra(1, 3)).toBe(33)
    expect(largoDeBarra(2, 3)).toBe(67)
  })

  it('el valor igual al maximo ocupa toda la barra', () => {
    expect(largoDeBarra(60, 60)).toBe(100)
    expect(largoDeBarra(5, 5)).toBe(100)
  })

  it('es 0 si el maximo es 0 (ambos valores en 0)', () => {
    expect(largoDeBarra(0, 0)).toBe(0)
  })

  it('es 0 si el valor es 0 o negativo', () => {
    expect(largoDeBarra(0, 10)).toBe(0)
    expect(largoDeBarra(-30, 10)).toBe(0)
  })

  it('no pasa de 100 aunque el valor supere al maximo', () => {
    expect(largoDeBarra(12, 10)).toBe(100)
  })

  it('un valor ausente no tiene barra', () => {
    expect(largoDeBarra(null, 10)).toBeNull()
    expect(largoDeBarra(null, 0)).toBeNull()
  })
})

describe('largosDeFila', () => {
  it('usa el mayor de los dos lados como maximo', () => {
    expect(largosDeFila(3475, 3600)).toEqual({ izquierda: 97, derecha: 100 })
    expect(largosDeFila(20, 5)).toEqual({ izquierda: 100, derecha: 25 })
  })

  it('con ambos en 0 las dos barras quedan en 0', () => {
    expect(largosDeFila(0, 0)).toEqual({ izquierda: 0, derecha: 0 })
  })

  it('con un lado ausente ese lado no tiene barra y el otro ocupa todo', () => {
    expect(largosDeFila(65, null)).toEqual({ izquierda: 100, derecha: null })
    expect(largosDeFila(null, 40)).toEqual({ izquierda: null, derecha: 100 })
    expect(largosDeFila(null, null)).toEqual({ izquierda: null, derecha: null })
  })
})
