import { describe, expect, it } from 'vitest'
import { sugerenciaDeReferencia } from '../../../../../tests/fixtures/calculo'
import { fichaDeReferencia } from '../../../../../tests/fixtures/ficha'
import type { SugerenciaDeValor } from '../../../../shared/calculo'
import { formularioDeFicha, formularioVacio, type FormularioDeFicha } from '../aniimo/formulario'
import {
  aplicarSugerencia,
  aplicarTodas,
  diferencia,
  entradaDesdeFormulario,
  estaDesactualizada,
  porNombre,
  valorMostrado
} from './sugerencia'

const ESPECIES = [
  { id: 'ejemplo-a', nombre: 'EJEMPLO Aniimo A' },
  { id: 'ejemplo-b', nombre: 'EJEMPLO Áñimo B' }
]

const SIN_OBJETOS_ELEGIDOS = { equipado: null, alternativo: null } as const

function formularioCon(cambios: Partial<FormularioDeFicha>): FormularioDeFicha {
  return { ...formularioDeFicha(fichaDeReferencia()), ...cambios }
}

describe('porNombre', () => {
  it('encuentra por igualdad sin mayusculas ni tildes', () => {
    expect(porNombre('ejemplo aniimo a', ESPECIES)).toBe('ejemplo-a')
    expect(porNombre('  EJEMPLO ANIIMO A  ', ESPECIES)).toBe('ejemplo-a')
    expect(porNombre('ejemplo animo b', ESPECIES)).toBe('ejemplo-b')
    expect(porNombre('Ejemplo Áñimo B', ESPECIES)).toBe('ejemplo-b')
  })

  it('devuelve null sin coincidencia exacta o con nombre vacio', () => {
    expect(porNombre('Irisalis', ESPECIES)).toBeNull()
    expect(porNombre('ejemplo aniimo', ESPECIES)).toBeNull()
    expect(porNombre('', ESPECIES)).toBeNull()
    expect(porNombre('   ', ESPECIES)).toBeNull()
    expect(porNombre('x', [])).toBeNull()
  })
})

describe('entradaDesdeFormulario', () => {
  it('arma el pedido con el nivel, los potenciales, la estrella, la personalidad y los objetos', () => {
    const resultado = entradaDesdeFormulario(formularioDeFicha(fichaDeReferencia()), 'ejemplo-a', {
      equipado: 'ejemplo-objeto-x',
      alternativo: null
    })

    expect(resultado).toEqual({
      ok: true,
      pedido: {
        especieId: 'ejemplo-a',
        nivel: 60,
        potenciales: { ps: 11, atq: 20, def_fisica: 5, def_magica: 4, regen: 20, quiebre: 6 },
        etapaEstrella: 6,
        personalidad: 'ENFJ',
        objetos: [
          { posicion: 'equipado', objetoId: 'ejemplo-objeto-x', nivel: 15 },
          { posicion: 'alternativo', objetoId: null, nivel: 4 }
        ]
      }
    })
  })

  it('sin objetos cargados en la ficha no manda ninguno', () => {
    const base = formularioDeFicha(fichaDeReferencia())
    const formulario = {
      ...base,
      objetos: base.objetos.map((objeto) => ({ ...objeto, nombre: '' }))
    }

    const resultado = entradaDesdeFormulario(formulario, 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)

    expect(resultado).toMatchObject({ ok: true, pedido: { objetos: [] } })
  })

  it('solo el objeto cargado en una posicion viaja, con su nivel', () => {
    const base = formularioDeFicha(fichaDeReferencia())
    const objetos = [base.objetos[0], { ...base.objetos[1]!, nombre: '', nivel: '9' }] as const
    const formulario = { ...base, objetos: [...objetos] as unknown as FormularioDeFicha['objetos'] }

    const resultado = entradaDesdeFormulario(formulario, 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)

    expect(resultado).toMatchObject({
      ok: true,
      pedido: { objetos: [{ posicion: 'equipado', objetoId: null, nivel: 15 }] }
    })
  })

  it('usa la etapa de estrella y nunca la estrella actual', () => {
    const formulario = formularioCon({ etapaEstrella: '3', estrellaActual: '9' })

    const resultado = entradaDesdeFormulario(formulario, 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)

    expect(resultado).toMatchObject({ ok: true, pedido: { etapaEstrella: 3 } })
    expect(resultado.ok && 'estrellaActual' in resultado.pedido).toBe(false)
  })

  it('con la etapa sin cargar el motivo pide cargarla y no asume T0', () => {
    const resultado = entradaDesdeFormulario(
      formularioCon({ etapaEstrella: '' }),
      'ejemplo-a',
      SIN_OBJETOS_ELEGIDOS
    )

    expect(resultado).toEqual({ ok: false, motivo: 'Cargá la etapa de estrella (T0-T7)' })
  })

  it('T0 es una etapa valida', () => {
    expect(
      entradaDesdeFormulario(formularioCon({ etapaEstrella: '0' }), 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)
    ).toMatchObject({ ok: true, pedido: { etapaEstrella: 0 } })
  })

  it('personalidad vacia se manda como null', () => {
    const formulario = formularioCon({ personalidad: ['', '', '', ''] })

    expect(entradaDesdeFormulario(formulario, 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)).toMatchObject({
      ok: true,
      pedido: { personalidad: null }
    })
  })

  it.each([
    ['nivel vacio', formularioCon({ nivel: '' })],
    ['nivel no numerico', formularioCon({ nivel: 'abc' })],
    ['nivel 0', formularioCon({ nivel: '0' })],
    ['nivel 1000', formularioCon({ nivel: '1000' })],
    ['etapa sin cargar', formularioCon({ etapaEstrella: '' })],
    ['etapa 8', formularioCon({ etapaEstrella: '8' })],
    ['personalidad incompleta', formularioCon({ personalidad: ['E', 'N', '', ''] })]
  ])('%s devuelve un motivo', (_caso, formulario) => {
    const resultado = entradaDesdeFormulario(formulario, 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)

    expect(resultado.ok).toBe(false)
    expect(resultado.ok === false && resultado.motivo.length).toBeGreaterThan(0)
  })

  it('un potencial no numerico o fuera de 0-20 devuelve un motivo que lo nombra', () => {
    const base = formularioDeFicha(fichaDeReferencia())
    const conPotencial = (potencial: string): FormularioDeFicha => ({
      ...base,
      stats: { ...base.stats, atq: { ...base.stats.atq, potencial } }
    })

    for (const potencial of ['', 'x', '21', '-1', '1.5']) {
      const resultado = entradaDesdeFormulario(conPotencial(potencial), 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)
      expect(resultado.ok).toBe(false)
      expect(resultado.ok === false && resultado.motivo).toContain('ATQ')
    }
  })

  it('un nivel de objeto cargado no numerico o fuera de 1-99 devuelve un motivo', () => {
    const base = formularioDeFicha(fichaDeReferencia())
    const conNivel = (nivel: string): FormularioDeFicha => ({
      ...base,
      objetos: [{ ...base.objetos[0]!, nivel }, base.objetos[1]!]
    })

    for (const nivel of ['', 'x', '0', '100']) {
      const resultado = entradaDesdeFormulario(conNivel(nivel), 'ejemplo-a', SIN_OBJETOS_ELEGIDOS)
      expect(resultado.ok).toBe(false)
      expect(resultado.ok === false && resultado.motivo).toContain('objeto equipado')
    }
  })

  it('un nivel vacio en un objeto sin cargar no impide calcular', () => {
    const base = formularioDeFicha(fichaDeReferencia())
    const formulario = {
      ...base,
      objetos: [base.objetos[0]!, { ...base.objetos[1]!, nombre: '', nivel: '' }] as const
    }

    expect(
      entradaDesdeFormulario(
        { ...base, objetos: [...formulario.objetos] as unknown as FormularioDeFicha['objetos'] },
        'ejemplo-a',
        SIN_OBJETOS_ELEGIDOS
      ).ok
    ).toBe(true)
  })
})

function sugerido(cambios: Partial<SugerenciaDeValor>): SugerenciaDeValor {
  return {
    valor: 458,
    valorConObjetos: 509,
    aproximado: false,
    motivo: null,
    desglose: [],
    ...cambios
  }
}

describe('valorMostrado', () => {
  it('elige el valor con o sin objetos segun el interruptor', () => {
    expect(valorMostrado(sugerido({}), true)).toBe(509)
    expect(valorMostrado(sugerido({}), false)).toBe(458)
  })

  it('devuelve null cuando la variante elegida no tiene valor', () => {
    expect(valorMostrado(sugerido({ valorConObjetos: null }), true)).toBeNull()
    expect(valorMostrado(sugerido({ valorConObjetos: null }), false)).toBe(458)
    expect(valorMostrado(sugerido({ valor: null, valorConObjetos: null }), false)).toBeNull()
  })
})

describe('aplicarSugerencia', () => {
  it('cambia solo el valor actual de ese stat', () => {
    const antes = formularioDeFicha(fichaDeReferencia())

    const despues = aplicarSugerencia(antes, 'atq', 509)

    expect(despues.stats.atq.valorActual).toBe('509')
    expect(despues.stats.atq.potencial).toBe(antes.stats.atq.potencial)
    expect(despues.stats.ps).toBe(antes.stats.ps)
    expect({ ...despues, stats: antes.stats }).toEqual(antes)
  })

  it('con cp cambia solo el CP', () => {
    const antes = formularioDeFicha(fichaDeReferencia())

    const despues = aplicarSugerencia(antes, 'cp', 629)

    expect(despues.cp).toBe('629')
    expect(despues.stats).toBe(antes.stats)
    expect({ ...despues, cp: antes.cp }).toEqual(antes)
  })

  it('no muta el formulario recibido', () => {
    const antes = formularioVacio()
    const copia = structuredClone(antes)

    aplicarSugerencia(antes, 'ps', 10)

    expect(antes).toEqual(copia)
  })
})

describe('aplicarTodas', () => {
  it('aplica los stats y el CP con valor y salta los nulos', () => {
    const base = sugerenciaDeReferencia()
    const sugerencia = {
      ...base,
      stats: {
        ...base.stats,
        quiebre: sugerido({ valor: null, valorConObjetos: null, motivo: 'fuera-de-rango' })
      },
      cp: sugerido({ valor: null, valorConObjetos: null, motivo: 'sin-datos' })
    }
    const antes = formularioDeFicha(fichaDeReferencia())

    const despues = aplicarTodas(antes, sugerencia, true)

    expect(despues.stats.atq.valorActual).toBe('522')
    expect(despues.stats.ps.valorActual).toBe('1000')
    expect(despues.stats.quiebre.valorActual).toBe(antes.stats.quiebre.valorActual)
    expect(despues.cp).toBe(antes.cp)
  })

  it('con el interruptor apagado aplica los valores sin objetos, CP incluido', () => {
    const despues = aplicarTodas(
      formularioDeFicha(fichaDeReferencia()),
      sugerenciaDeReferencia(),
      false
    )

    expect(despues.stats.atq.valorActual).toBe('474')
    expect(despues.cp).toBe('594')
  })

  it('con el interruptor encendido aplica el CP con objetos', () => {
    const despues = aplicarTodas(
      formularioDeFicha(fichaDeReferencia()),
      sugerenciaDeReferencia(),
      true
    )

    expect(despues.cp).toBe('642')
  })
})

describe('diferencia', () => {
  it('resta lo cargado al sugerido', () => {
    expect(diferencia('450', 458)).toBe(8)
    expect(diferencia('500', 458)).toBe(-42)
    expect(diferencia('458', 458)).toBe(0)
  })

  it('es null si lo cargado no es un numero o no hay sugerido', () => {
    expect(diferencia('', 458)).toBeNull()
    expect(diferencia('abc', 458)).toBeNull()
    expect(diferencia('450', null)).toBeNull()
  })
})

describe('estaDesactualizada', () => {
  const calculado = (() => {
    const resultado = entradaDesdeFormulario(
      formularioDeFicha(fichaDeReferencia()),
      'ejemplo-a',
      SIN_OBJETOS_ELEGIDOS
    )
    if (!resultado.ok) {
      throw new Error('fixture invalido')
    }
    return resultado.pedido
  })()

  const actualCon = (formulario: FormularioDeFicha, especieId = 'ejemplo-a') => {
    const resultado = entradaDesdeFormulario(formulario, especieId, SIN_OBJETOS_ELEGIDOS)
    return resultado.ok ? resultado.pedido : null
  }
  const base = formularioDeFicha(fichaDeReferencia())

  it('no esta desactualizada si el pedido actual es igual', () => {
    expect(estaDesactualizada(actualCon(base), calculado)).toBe(false)
  })

  it.each([
    ['el nivel', { ...base, nivel: '61' }],
    ['la etapa de estrella', { ...base, etapaEstrella: '3' }],
    ['la personalidad', { ...base, personalidad: ['I', 'N', 'F', 'J'] as const }],
    ['un potencial', { ...base, stats: { ...base.stats, ps: { ...base.stats.ps, potencial: '12' } } }],
    ['el nivel de un objeto', { ...base, objetos: [{ ...base.objetos[0]!, nivel: '16' }, base.objetos[1]!] }]
  ])('queda desactualizada si cambia %s', (_caso, formulario) => {
    expect(estaDesactualizada(actualCon(formulario as FormularioDeFicha), calculado)).toBe(true)
  })

  it('queda desactualizada si cambia la especie o la entrada deja de ser valida', () => {
    expect(estaDesactualizada(actualCon(base, 'ejemplo-b'), calculado)).toBe(true)
    expect(estaDesactualizada(actualCon({ ...base, nivel: '' }), calculado)).toBe(true)
    expect(estaDesactualizada(null, calculado)).toBe(true)
  })

  it('cambiar el valor actual, el CP o las notas no la desactualiza', () => {
    const otro = {
      ...base,
      cp: '1',
      notas: 'otra',
      stats: { ...base.stats, atq: { ...base.stats.atq, valorActual: '1' } }
    }

    expect(estaDesactualizada(actualCon(otro), calculado)).toBe(false)
  })
})
