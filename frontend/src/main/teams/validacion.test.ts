import { describe, expect, it } from 'vitest'
import { fichaDeReferencia } from '../../../tests/fixtures/ficha'
import type { FichaEntrada } from '../../shared/teams'
import {
  esFichaEntrada,
  esPedidoCrear,
  esPedidoDeSlot,
  esPedidoDeTeam,
  esPedidoGuardarFicha,
  esPedidoRenombrar,
  validarPedidoDeImagen
} from './validacion'

const TEAM_ID = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'

type Registro = Record<string, unknown>
type Cambio = (ficha: Registro) => void

function conCambios(cambio: Cambio): unknown {
  const ficha = structuredClone(fichaDeReferencia()) as unknown as Registro
  cambio(ficha)
  return ficha
}

function en(ficha: Registro, ...ruta: (string | number)[]): Registro {
  let actual: unknown = ficha
  for (const clave of ruta) {
    actual = (actual as Record<string | number, unknown>)[clave]
  }
  return actual as Registro
}

describe('esPedidoCrear', () => {
  it('acepta un nombre de hasta 50 caracteres', () => {
    expect(esPedidoCrear({ nombre: 'Raid' })).toBe(true)
    expect(esPedidoCrear({ nombre: 'x'.repeat(50) })).toBe(true)
  })

  it.each([
    ['null', null],
    ['string', 'Raid'],
    ['sin nombre', {}],
    ['nombre numerico', { nombre: 5 }],
    ['nombre de 51', { nombre: 'x'.repeat(51) }],
    ['clave extra', { nombre: 'Raid', orden: 1 }],
    ['arreglo', ['Raid']]
  ])('rechaza %s', (_caso, valor) => {
    expect(esPedidoCrear(valor)).toBe(false)
  })
})

describe('pedidos con team y slot', () => {
  it('acepta teamId UUID y slot entero de 1 a 4', () => {
    expect(esPedidoDeTeam({ teamId: TEAM_ID })).toBe(true)
    for (const slot of [1, 2, 3, 4]) {
      expect(esPedidoDeSlot({ teamId: TEAM_ID, slot })).toBe(true)
    }
    expect(esPedidoRenombrar({ teamId: TEAM_ID, nombre: 'Raid' })).toBe(true)
  })

  it.each([
    ['slot 0', { teamId: TEAM_ID, slot: 0 }],
    ['slot 5', { teamId: TEAM_ID, slot: 5 }],
    ['slot string', { teamId: TEAM_ID, slot: '1' }],
    ['slot decimal', { teamId: TEAM_ID, slot: 1.5 }],
    ['slot NaN', { teamId: TEAM_ID, slot: Number.NaN }],
    ['teamId no UUID', { teamId: 'no-es-uuid', slot: 1 }],
    ['teamId vacio', { teamId: '', slot: 1 }],
    ['teamId numerico', { teamId: 5, slot: 1 }],
    ['clave extra', { teamId: TEAM_ID, slot: 1, extra: true }],
    ['sin slot', { teamId: TEAM_ID }]
  ])('esPedidoDeSlot rechaza %s', (_caso, valor) => {
    expect(esPedidoDeSlot(valor)).toBe(false)
  })

  it('esPedidoDeTeam y esPedidoRenombrar rechazan claves extra y datos invalidos', () => {
    expect(esPedidoDeTeam({ teamId: TEAM_ID, slot: 1 })).toBe(false)
    expect(esPedidoDeTeam({ teamId: 'x' })).toBe(false)
    expect(esPedidoRenombrar({ teamId: TEAM_ID })).toBe(false)
    expect(esPedidoRenombrar({ teamId: TEAM_ID, nombre: 'x'.repeat(51) })).toBe(false)
  })
})

describe('esFichaEntrada', () => {
  it('acepta la ficha de referencia completa', () => {
    expect(esFichaEntrada(fichaDeReferencia())).toBe(true)
  })

  it('acepta opcionales en null, listas vacias y personalidad nula', () => {
    const base = fichaDeReferencia()
    const ficha: FichaEntrada = {
      ...base,
      elemento: null,
      rol: null,
      potencialInnato: null,
      personalidad: null,
      objetos: [],
      notasHabilidades: null,
      notas: null,
      entrenamiento: { ...base.entrenamiento, nivelRequeridoSiguienteEtapa: null, materiales: [] }
    }
    expect(esFichaEntrada(ficha)).toBe(true)
  })

  const rechazos: [string, Cambio][] = [
    ['clave extra en la raiz', (f) => (f.descuento = 1)],
    ['clave extra en un stat', (f) => (en(f, 'stats', 'atq').descuento = 1)],
    ['clave extra en entrenamiento', (f) => (en(f, 'entrenamiento').extra = 1)],
    ['stat faltante', (f) => delete en(f, 'stats').quiebre],
    ['stat extra', (f) => (en(f, 'stats').velocidad = en(f, 'stats', 'ps'))],
    ['clave raiz faltante', (f) => delete f.notas],
    ['clave faltante en un stat', (f) => delete en(f, 'stats', 'ps').notas],
    ['elemento desconocido', (f) => (f.elemento = 'metal')],
    ['elemento con etiqueta', (f) => (f.elemento = 'Eléctrico')],
    ['rol desconocido', (f) => (f.rol = 'mago')],
    ['potencial innato desconocido', (f) => (f.potencialInnato = 'divino')],
    ['personalidad invalida', (f) => (f.personalidad = 'EEFJ')],
    ['personalidad minuscula', (f) => (f.personalidad = 'enfj')],
    ['nivel string', (f) => (f.nivel = '60')],
    ['nivel decimal', (f) => (f.nivel = 60.5)],
    ['nivel inseguro', (f) => (f.nivel = Number.MAX_SAFE_INTEGER + 2)],
    ['nivel Infinity', (f) => (f.nivel = Number.POSITIVE_INFINITY)],
    ['nombre null', (f) => (f.nombre = null)],
    ['nombre de 51', (f) => (f.nombre = 'x'.repeat(51))],
    ['notas de 4001', (f) => (f.notas = 'x'.repeat(4001))],
    ['notas de habilidades de 4001', (f) => (f.notasHabilidades = 'x'.repeat(4001))],
    ['notas de stat de 501', (f) => (en(f, 'stats', 'ps').notas = 'x'.repeat(501))],
    ['stat con valor null', (f) => (en(f, 'stats', 'ps').valorActual = null)],
    ['despertares null', (f) => (en(f, 'entrenamiento').despertaresUsados = null)],
    ['materiales no arreglo', (f) => (en(f, 'entrenamiento').materiales = {})],
    ['material con clave extra', (f) => (en(f, 'entrenamiento', 'materiales', 0).x = 1)],
    ['material sin nombre', (f) => delete en(f, 'entrenamiento', 'materiales', 0).nombre],
    ['objetos no arreglo', (f) => (f.objetos = null)],
    ['objeto con rareza desconocida', (f) => (en(f, 'objetos', 0).rareza = 'mitica')],
    ['objeto con posicion desconocida', (f) => (en(f, 'objetos', 0).posicion = 'reserva')],
    ['contrato string', (f) => (en(f, 'objetos', 0).contrato = 'true')],
    ['efecto nucleo de 1001', (f) => (en(f, 'objetos', 0).efectoNucleoNotas = 'x'.repeat(1001))],
    ['objeto con clave extra', (f) => (en(f, 'objetos', 1).descuento = 1)]
  ]

  it.each(rechazos)('rechaza: %s', (_caso, cambio) => {
    expect(esFichaEntrada(conCambios(cambio))).toBe(false)
  })

  it('rechaza valores que no son objetos planos', () => {
    expect(esFichaEntrada(null)).toBe(false)
    expect(esFichaEntrada([])).toBe(false)
    expect(esFichaEntrada('ficha')).toBe(false)
    expect(esFichaEntrada(new Map())).toBe(false)
  })

  it('esPedidoGuardarFicha exige team, slot y ficha exactos', () => {
    const ficha = fichaDeReferencia()
    expect(esPedidoGuardarFicha({ teamId: TEAM_ID, slot: 2, ficha })).toBe(true)
    expect(esPedidoGuardarFicha({ teamId: TEAM_ID, slot: 2 })).toBe(false)
    expect(esPedidoGuardarFicha({ teamId: TEAM_ID, slot: 9, ficha })).toBe(false)
    expect(esPedidoGuardarFicha({ teamId: TEAM_ID, slot: 2, ficha, extra: 1 })).toBe(false)
    expect(
      esPedidoGuardarFicha({ teamId: TEAM_ID, slot: 2, ficha: { ...ficha, elemento: 'metal' } })
    ).toBe(false)
  })
})

describe('validarPedidoDeImagen', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
  const pedido = (cambios: Registro = {}): unknown => ({
    teamId: TEAM_ID,
    slot: 1,
    tipo: 'image/png',
    datos: png,
    ...cambios
  })

  it.each(['image/png', 'image/jpeg', 'image/webp'])('acepta %s con bytes validos', (tipo) => {
    expect(validarPedidoDeImagen(pedido({ tipo }))).toBe('valido')
  })

  it('acepta exactamente 1 048 576 bytes', () => {
    expect(validarPedidoDeImagen(pedido({ datos: new Uint8Array(1_048_576) }))).toBe('valido')
  })

  it.each([
    ['ArrayBuffer', pedido({ datos: new ArrayBuffer(4) })],
    ['arreglo comun', pedido({ datos: [1, 2, 3] })],
    ['0 bytes', pedido({ datos: new Uint8Array(0) })],
    ['1 048 577 bytes', pedido({ datos: new Uint8Array(1_048_577) })],
    ['svg', pedido({ tipo: 'image/svg+xml' })],
    ['gif', pedido({ tipo: 'image/gif' })],
    ['tipo numerico', pedido({ tipo: 5 })]
  ])('%s se clasifica como imagen-invalida', (_caso, valor) => {
    expect(validarPedidoDeImagen(valor)).toBe('imagen-invalida')
  })

  it.each([
    ['null', null],
    ['slot fuera de rango', pedido({ slot: 5 })],
    ['teamId invalido', pedido({ teamId: 'x' })],
    ['clave extra', pedido({ extra: 1 })],
    ['sin datos', { teamId: TEAM_ID, slot: 1, tipo: 'image/png' }]
  ])('%s se clasifica como datos-invalidos', (_caso, valor) => {
    expect(validarPedidoDeImagen(valor)).toBe('datos-invalidos')
  })
})
