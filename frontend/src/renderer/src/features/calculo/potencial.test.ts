import { describe, expect, it } from 'vitest'
import { pedidoDePotencialDeReferencia } from '../../../../../tests/fixtures/calculo'
import { fichaDeReferencia } from '../../../../../tests/fixtures/ficha'
import { formularioDeFicha, type FormularioDeFicha } from '../aniimo/formulario'
import {
  aplicarCupo,
  entradaDePotencial,
  estaDesactualizado,
  etiquetaDeViaDespertar,
  textoDeConfianza
} from './potencial'

function formularioCon(cambios: Partial<FormularioDeFicha>): FormularioDeFicha {
  return { ...formularioDeFicha(fichaDeReferencia()), ...cambios }
}

function sinObjetoEquipado(base: FormularioDeFicha): FormularioDeFicha {
  const objetos = base.objetos.map((objeto, indice) =>
    indice === 0 ? { ...objeto, nombre: '' } : objeto
  ) as unknown as FormularioDeFicha['objetos']
  return { ...base, objetos }
}

const SIN_OBJETO = null

describe('entradaDePotencial', () => {
  it('arma el pedido de Irisalis con el objeto equipado elegido y la fecha de la ficha', () => {
    const resultado = entradaDePotencial(formularioCon({}), 'ejemplo-objeto-x')

    expect(resultado).toEqual({
      ok: true,
      pedido: {
        ...pedidoDePotencialDeReferencia(),
        objetoEquipado: { objetoId: 'ejemplo-objeto-x', nivel: 15 },
        fechaParche: '2026-10-26'
      }
    })
  })

  it('con el objeto equipado sin elegir manda objetoId null', () => {
    expect(entradaDePotencial(formularioCon({}), SIN_OBJETO)).toMatchObject({
      ok: true,
      pedido: { objetoEquipado: { objetoId: null, nivel: 15 } }
    })
  })

  it('sin objeto equipado cargado en la ficha manda objetoEquipado null', () => {
    const formulario = sinObjetoEquipado(formularioCon({}))

    expect(entradaDePotencial(formulario, 'ejemplo-objeto-x')).toMatchObject({
      ok: true,
      pedido: { objetoEquipado: null }
    })
  })

  it('el objeto alternativo nunca viaja', () => {
    const resultado = entradaDePotencial(formularioCon({}), SIN_OBJETO)

    expect(resultado.ok && JSON.stringify(resultado.pedido)).not.toContain('alternativo')
  })

  it('la fecha vacia viaja como null y la personalidad vacia tambien', () => {
    const resultado = entradaDePotencial(
      formularioCon({ fechaParche: '', personalidad: ['', '', '', ''] }),
      SIN_OBJETO
    )

    expect(resultado).toMatchObject({ ok: true, pedido: { fechaParche: null, personalidad: null } })
  })

  it('usa etapaEstrella y nunca estrellaActual', () => {
    const resultado = entradaDePotencial(
      formularioCon({ etapaEstrella: '4', estrellaActual: '9' }),
      SIN_OBJETO
    )

    expect(resultado).toMatchObject({ ok: true, pedido: { etapaEstrella: 4 } })
    expect(resultado.ok && 'estrellaActual' in resultado.pedido).toBe(false)
  })

  it.each([
    ['etapa sin cargar', formularioCon({ etapaEstrella: '' }), 'Cargá la etapa de estrella (T0-T7)'],
    [
      'usados mayor que total',
      formularioCon({ despertaresUsados: '44', despertaresTotal: '43' }),
      'Los despertares usados no pueden superar los totales'
    ],
    [
      'usados no numerico',
      formularioCon({ despertaresUsados: 'x' }),
      'Revisá los despertares: deben ser números enteros válidos'
    ],
    [
      'total vacio',
      formularioCon({ despertaresTotal: '' }),
      'Revisá los despertares: deben ser números enteros válidos'
    ],
    [
      'nivel vacio',
      formularioCon({ nivel: '' }),
      'Revisá el nivel: debe ser un número entre 1 y 999'
    ],
    [
      'fecha invalida',
      formularioCon({ fechaParche: '2026-02-30' }),
      'Ingresá una fecha válida entre 2020 y 2099'
    ],
    [
      'personalidad incompleta',
      formularioCon({ personalidad: ['E', 'N', '', ''] }),
      'Completá las cuatro letras o dejá todas vacías'
    ]
  ])('%s deshabilita con su motivo', (_caso, formulario, motivo) => {
    expect(entradaDePotencial(formulario, SIN_OBJETO)).toEqual({ ok: false, motivo })
  })

  it('un potencial fuera de 0-20 nombra el stat', () => {
    const base = formularioCon({})
    const formulario = {
      ...base,
      stats: { ...base.stats, atq: { ...base.stats.atq, potencial: '21' } }
    }

    expect(entradaDePotencial(formulario, SIN_OBJETO)).toEqual({
      ok: false,
      motivo: 'Revisá el potencial de ATQ: debe ser un número entre 0 y 20'
    })
  })

  it('un nivel de objeto equipado invalido da su motivo', () => {
    const base = formularioCon({})
    const objetos = base.objetos.map((objeto, indice) =>
      indice === 0 ? { ...objeto, nivel: '100' } : objeto
    ) as unknown as FormularioDeFicha['objetos']

    expect(entradaDePotencial({ ...base, objetos }, SIN_OBJETO)).toEqual({
      ok: false,
      motivo: 'Revisá el nivel del objeto equipado: debe ser un número entre 1 y 99'
    })
  })
})

describe('aplicarCupo', () => {
  it('cambia solo los despertares totales', () => {
    const antes = formularioCon({})

    const despues = aplicarCupo(antes, 30)

    expect(despues.despertaresTotal).toBe('30')
    expect({ ...despues, despertaresTotal: antes.despertaresTotal }).toEqual(antes)
  })

  it('acepta cualquier cupo, tambien menor al usado', () => {
    expect(aplicarCupo(formularioCon({}), 5).despertaresTotal).toBe('5')
  })
})

describe('etiquetaDeViaDespertar', () => {
  it('traduce las tres vias', () => {
    expect(etiquetaDeViaDespertar('si')).toBe('sí')
    expect(etiquetaDeViaDespertar('sin-cupo')).toBe('sin cupo')
    expect(etiquetaDeViaDespertar('tope')).toBe('no: solo estrellas u objetos')
  })
})

describe('textoDeConfianza', () => {
  it('muestra la etiqueta de cada nivel de confianza', () => {
    expect(textoDeConfianza('medido')).toBe('medido')
    expect(textoDeConfianza('fan')).toBe('dato de fans')
    expect(textoDeConfianza('inferido')).toBe('inferido')
    expect(textoDeConfianza('oficial')).toBe('oficial')
    expect(textoDeConfianza('contradictorio')).toBe('contradictorio')
    expect(textoDeConfianza('ejemplo')).toBe('de ejemplo')
  })
})

describe('estaDesactualizado', () => {
  const actualCon = (formulario: FormularioDeFicha, elegido: string | null = null) => {
    const resultado = entradaDePotencial(formulario, elegido)
    return resultado.ok ? resultado.pedido : null
  }
  const base = formularioCon({ fechaParche: '' })
  const baseCalculada = actualCon(base)

  it('no lo esta si el pedido actual es igual', () => {
    expect(baseCalculada).not.toBeNull()
    expect(estaDesactualizado(actualCon(base), baseCalculada!)).toBe(false)
  })

  it.each([
    ['la etapa', { ...base, etapaEstrella: '5' }],
    ['un potencial', { ...base, stats: { ...base.stats, ps: { ...base.stats.ps, potencial: '12' } } }],
    ['los despertares totales', { ...base, despertaresTotal: '50' }],
    ['la fecha de parche', { ...base, fechaParche: '2026-10-01' }],
    ['la personalidad', { ...base, personalidad: ['I', 'N', 'F', 'J'] as const }],
    ['el nivel', { ...base, nivel: '61' }]
  ])('queda desactualizado si cambia %s', (_caso, formulario) => {
    expect(estaDesactualizado(actualCon(formulario as FormularioDeFicha), baseCalculada!)).toBe(
      true
    )
  })

  it('queda desactualizado si cambia el objeto elegido o la entrada deja de ser valida', () => {
    expect(estaDesactualizado(actualCon(base, 'ejemplo-objeto-x'), baseCalculada!)).toBe(true)
    expect(estaDesactualizado(actualCon({ ...base, etapaEstrella: '' }), baseCalculada!)).toBe(true)
  })

  it('cambiar el CP, un valor actual o las notas no lo desactualiza', () => {
    const otro = {
      ...base,
      cp: '1',
      notas: 'otra',
      stats: { ...base.stats, atq: { ...base.stats.atq, valorActual: '1' } }
    }
    expect(estaDesactualizado(actualCon(otro), baseCalculada!)).toBe(false)
  })
})
