import { describe, expect, it, vi } from 'vitest'
import {
  catalogoDeReferencia,
  pedidoDePotencialDeReferencia,
  pedidoDeReferencia,
  potencialDeReferencia,
  sugerenciaDeReferencia
} from '../../../tests/fixtures/calculo'
import { CANALES_CALCULO } from '../../shared/calculo'
import type { EventoIpc, IpcPrincipal } from '../auth/ipcAuth'
import type { ClienteCalculo } from './clienteCalculo'
import { registrarManejadoresDeCalculo } from './ipcCalculo'

const URL_APP = 'http://localhost:5173'
const ORIGEN_PROPIO: EventoIpc = { senderFrame: { url: 'http://localhost:5173/' } }
const ORIGEN_AJENO: EventoIpc = { senderFrame: { url: 'https://example.com/' } }
const SIN_FRAME: EventoIpc = { senderFrame: null }

function preparar(sobrescribir: Partial<ClienteCalculo> = {}) {
  const manejadores = new Map<string, (evento: EventoIpc, payload?: unknown) => Promise<unknown>>()
  const ipc: IpcPrincipal = {
    handle: (canal, manejador) => {
      manejadores.set(canal, manejador)
    }
  }
  const cliente = {
    obtenerCatalogo: vi.fn(async () => ({ ok: true as const, catalogo: catalogoDeReferencia() })),
    calcular: vi.fn(async () => ({ ok: true as const, sugerencia: sugerenciaDeReferencia() })),
    potencial: vi.fn(async () => ({ ok: true as const, potencial: potencialDeReferencia() })),
    ...sobrescribir
  } satisfies ClienteCalculo
  registrarManejadoresDeCalculo(ipc, cliente, URL_APP)
  const invocar = (canal: string, evento: EventoIpc, payload?: unknown): Promise<unknown> => {
    const manejador = manejadores.get(canal)
    if (manejador === undefined) {
      throw new Error(`canal sin manejador: ${canal}`)
    }
    return manejador(evento, payload)
  }
  return { manejadores, cliente, invocar }
}

const DATOS_INVALIDOS = { ok: false, error: 'datos-invalidos' }

describe('registrarManejadoresDeCalculo', () => {
  it('registra exactamente los tres canales de calculo', () => {
    const { manejadores } = preparar()

    expect([...manejadores.keys()].sort()).toEqual(Object.values(CANALES_CALCULO).sort())
    expect(manejadores.size).toBe(3)
  })

  it('obtener-catalogo con remitente propio llama al cliente', async () => {
    const { cliente, invocar } = preparar()

    const resultado = await invocar(CANALES_CALCULO.obtenerCatalogo, ORIGEN_PROPIO)

    expect(resultado).toMatchObject({ ok: true })
    expect(cliente.obtenerCatalogo).toHaveBeenCalledTimes(1)
  })

  it('calcular con remitente propio y pedido valido llama al cliente con el pedido', async () => {
    const { cliente, invocar } = preparar()

    const resultado = await invocar(CANALES_CALCULO.calcular, ORIGEN_PROPIO, pedidoDeReferencia())

    expect(resultado).toMatchObject({ ok: true })
    expect(cliente.calcular).toHaveBeenCalledWith(pedidoDeReferencia())
  })

  it.each([
    [CANALES_CALCULO.obtenerCatalogo, undefined],
    [CANALES_CALCULO.calcular, pedidoDeReferencia()],
    [CANALES_CALCULO.potencial, pedidoDePotencialDeReferencia()]
  ])('%s con remitente ajeno responde datos-invalidos sin llamar al cliente', async (canal, payload) => {
    const { cliente, invocar } = preparar()

    for (const evento of [ORIGEN_AJENO, SIN_FRAME]) {
      expect(await invocar(canal, evento, payload)).toEqual(DATOS_INVALIDOS)
    }
    expect(cliente.obtenerCatalogo).not.toHaveBeenCalled()
    expect(cliente.calcular).not.toHaveBeenCalled()
    expect(cliente.potencial).not.toHaveBeenCalled()
  })

  it.each([
    ['nivel string', { ...pedidoDeReferencia(), nivel: '30' }],
    ['clave extra', { ...pedidoDeReferencia(), extra: 1 }],
    ['null', null],
    ['undefined', undefined]
  ])('calcular con pedido invalido (%s) no llama al cliente', async (_caso, payload) => {
    const { cliente, invocar } = preparar()

    expect(await invocar(CANALES_CALCULO.calcular, ORIGEN_PROPIO, payload)).toEqual(DATOS_INVALIDOS)
    expect(cliente.calcular).not.toHaveBeenCalled()
  })

  it('una excepcion del cliente se traduce a error-inesperado', async () => {
    const { invocar } = preparar({
      calcular: vi.fn(async () => {
        throw new Error('boom')
      })
    })

    expect(
      await invocar(CANALES_CALCULO.calcular, ORIGEN_PROPIO, pedidoDeReferencia())
    ).toEqual({ ok: false, error: 'error-inesperado' })
  })
})


describe('canal de potencial', () => {
  it('con remitente propio y pedido valido llama al cliente con el pedido', async () => {
    const { cliente, invocar } = preparar()

    const resultado = await invocar(
      CANALES_CALCULO.potencial,
      ORIGEN_PROPIO,
      pedidoDePotencialDeReferencia()
    )

    expect(resultado).toMatchObject({ ok: true })
    expect(cliente.potencial).toHaveBeenCalledWith(pedidoDePotencialDeReferencia())
  })

  it.each([
    ['usados mayor que total', { ...pedidoDePotencialDeReferencia(), despertaresUsados: 44 }],
    ['fecha invalida', { ...pedidoDePotencialDeReferencia(), fechaParche: '2026-13-01' }],
    ['clave extra', { ...pedidoDePotencialDeReferencia(), extra: 1 }],
    ['con estrellaActual', { ...pedidoDePotencialDeReferencia(), estrellaActual: 2 }],
    ['null', null],
    ['undefined', undefined]
  ])('con payload invalido (%s) no llama al cliente', async (_caso, payload) => {
    const { cliente, invocar } = preparar()

    expect(await invocar(CANALES_CALCULO.potencial, ORIGEN_PROPIO, payload)).toEqual(
      DATOS_INVALIDOS
    )
    expect(cliente.potencial).not.toHaveBeenCalled()
  })

  it('una excepcion del cliente se traduce a error-inesperado', async () => {
    const { invocar } = preparar({
      potencial: vi.fn(async () => {
        throw new Error('boom')
      })
    })

    expect(
      await invocar(CANALES_CALCULO.potencial, ORIGEN_PROPIO, pedidoDePotencialDeReferencia())
    ).toEqual({ ok: false, error: 'error-inesperado' })
  })
})
