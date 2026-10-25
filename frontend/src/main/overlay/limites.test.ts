import { describe, expect, it } from 'vitest'
import { ajustarAPantallas, esLimitesValidos, LIMITES_POR_DEFECTO } from './limites'

const PRINCIPAL = { x: 0, y: 0, width: 1920, height: 1040 }
const SEGUNDO = { x: 1920, y: 0, width: 1920, height: 1040 }
const VALIDO = { x: 10, y: 20, width: 360, height: 520 }

describe('esLimitesValidos', () => {
  it('acepta enteros dentro de rango', () => {
    expect(esLimitesValidos(VALIDO)).toBe(true)
    expect(esLimitesValidos({ x: -1920, y: -50, width: 280, height: 200 })).toBe(true)
    expect(esLimitesValidos({ x: 0, y: 0, width: 3840, height: 2160 })).toBe(true)
  })

  it.each([
    ['clave extra', { ...VALIDO, z: 1 }],
    ['clave faltante', { x: 1, y: 2, width: 300 }],
    ['no entero', { ...VALIDO, x: 1.5 }],
    ['NaN', { ...VALIDO, width: Number.NaN }],
    ['Infinity', { ...VALIDO, height: Infinity }],
    ['string', { ...VALIDO, y: '5' }],
    ['ancho menor al minimo', { ...VALIDO, width: 279 }],
    ['alto menor al minimo', { ...VALIDO, height: 199 }],
    ['ancho mayor al maximo', { ...VALIDO, width: 3841 }],
    ['alto mayor al maximo', { ...VALIDO, height: 2161 }],
    ['null', null],
    ['array', [1, 2, 3, 4]],
    ['string suelto', 'x'],
    ['undefined', undefined]
  ])('rechaza %s', (_nombre, valor) => {
    expect(esLimitesValidos(valor)).toBe(false)
  })
})

describe('ajustarAPantallas', () => {
  const centrado = {
    x: (1920 - LIMITES_POR_DEFECTO.width) / 2,
    y: Math.round((1040 - LIMITES_POR_DEFECTO.height) / 2),
    width: 360,
    height: 520
  }

  it('el valor por defecto mide 360x520', () => {
    expect(LIMITES_POR_DEFECTO).toEqual({ width: 360, height: 520 })
  })

  it('con null devuelve el defecto centrado en el principal', () => {
    expect(ajustarAPantallas(null, [PRINCIPAL], PRINCIPAL)).toEqual(centrado)
  })

  it('centra relativo a un principal que no esta en el origen', () => {
    const resultado = ajustarAPantallas(null, [SEGUNDO], SEGUNDO)
    expect(resultado.x).toBe(1920 + 780)
  })

  it('conserva una posicion en un segundo monitor conectado', () => {
    const guardado = { x: 2000, y: 100, width: 360, height: 520 }
    expect(ajustarAPantallas(guardado, [PRINCIPAL, SEGUNDO], PRINCIPAL)).toEqual(guardado)
  })

  it('con el segundo monitor desconectado vuelve al defecto centrado', () => {
    const guardado = { x: 2000, y: 100, width: 360, height: 520 }
    expect(ajustarAPantallas(guardado, [PRINCIPAL], PRINCIPAL)).toEqual(centrado)
  })

  it('si solo se ve la parte de abajo vuelve al defecto', () => {
    const guardado = { x: 100, y: 1030, width: 360, height: 520 }
    expect(ajustarAPantallas(guardado, [PRINCIPAL], PRINCIPAL)).toEqual(centrado)
  })

  it('acepta un rectangulo parcialmente fuera si la barra superior sigue visible', () => {
    const guardado = { x: -290, y: 10, width: 360, height: 520 }
    expect(ajustarAPantallas(guardado, [PRINCIPAL], PRINCIPAL)).toEqual(guardado)
  })

  it('rechaza si la franja visible es menor a 64 px de ancho', () => {
    const guardado = { x: -297, y: 10, width: 360, height: 520 }
    expect(ajustarAPantallas({ ...guardado, x: -297 }, [PRINCIPAL], PRINCIPAL)).toEqual(centrado)
  })
})
