import { describe, expect, it, vi } from 'vitest'
import { CANALES_OVERLAY } from '../../shared/overlay'
import type { EventoIpc, IpcPrincipal } from '../auth/ipcAuth'
import type { ControladorOverlay } from './controladorOverlay'
import { registrarManejadoresDeOverlay } from './ipcOverlay'

const URL_APP = 'http://localhost:5173'
const PROPIO: EventoIpc = { senderFrame: { url: 'http://localhost:5173/#overlay' } }
const AJENO: EventoIpc = { senderFrame: { url: 'https://example.com/' } }
const SIN_FRAME: EventoIpc = { senderFrame: null }
const T1 = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'

function preparar(sobrescribir: Partial<ControladorOverlay> = {}) {
  const manejadores = new Map<string, (e: EventoIpc, p?: unknown) => Promise<unknown>>()
  const ipc: IpcPrincipal = {
    handle: (canal, manejador) => {
      manejadores.set(canal, manejador)
    }
  }
  const controlador = {
    abrir: vi.fn(async () => ({ ok: true as const })),
    cerrar: vi.fn(),
    seleccion: vi.fn(() => null),
    ...sobrescribir
  } satisfies ControladorOverlay
  registrarManejadoresDeOverlay(ipc, controlador, URL_APP)
  const invocar = (canal: string, evento: EventoIpc, payload?: unknown) => {
    const manejador = manejadores.get(canal)
    if (manejador === undefined) {
      throw new Error(`sin manejador ${canal}`)
    }
    return manejador(evento, payload)
  }
  return { manejadores, controlador, invocar }
}

describe('registrarManejadoresDeOverlay', () => {
  it('registra exactamente los tres canales', () => {
    const { manejadores } = preparar()
    expect([...manejadores.keys()].sort()).toEqual(Object.values(CANALES_OVERLAY).sort())
    expect(manejadores.size).toBe(3)
  })

  it('abrir con payload valido llama al controlador', async () => {
    const { controlador, invocar } = preparar()
    expect(await invocar(CANALES_OVERLAY.abrir, PROPIO, { teamId: T1 })).toEqual({ ok: true })
    expect(controlador.abrir).toHaveBeenCalledWith(T1)
  })

  it.each([{ teamId: 'abc' }, { teamId: T1, extra: 1 }, null, 'texto'])(
    'abrir con payload invalido %j responde datos-invalidos',
    async (payload) => {
      const { controlador, invocar } = preparar()
      expect(await invocar(CANALES_OVERLAY.abrir, PROPIO, payload)).toEqual({
        ok: false,
        error: 'datos-invalidos'
      })
      expect(controlador.abrir).not.toHaveBeenCalled()
    }
  )

  it.each([CANALES_OVERLAY.abrir, CANALES_OVERLAY.cerrar, CANALES_OVERLAY.obtenerSeleccion])(
    '%s con remitente ajeno responde datos-invalidos sin tocar el overlay',
    async (canal) => {
      const { controlador, invocar } = preparar()
      for (const evento of [AJENO, SIN_FRAME]) {
        expect(await invocar(canal, evento, { teamId: T1 })).toEqual({
          ok: false,
          error: 'datos-invalidos'
        })
      }
      expect(controlador.abrir).not.toHaveBeenCalled()
      expect(controlador.cerrar).not.toHaveBeenCalled()
      expect(controlador.seleccion).not.toHaveBeenCalled()
    }
  )

  it('abrir sin sesion responde sesion-vencida', async () => {
    const { invocar } = preparar({
      abrir: vi.fn(async () => ({ ok: false as const, error: 'sesion-vencida' as const }))
    })
    expect(await invocar(CANALES_OVERLAY.abrir, PROPIO, { teamId: T1 })).toEqual({
      ok: false,
      error: 'sesion-vencida'
    })
  })

  it('una excepcion responde error-inesperado sin filtrar texto', async () => {
    const { invocar } = preparar({
      abrir: vi.fn(async () => {
        throw new Error('boom tok-123')
      })
    })
    const resultado = await invocar(CANALES_OVERLAY.abrir, PROPIO, { teamId: T1 })
    expect(resultado).toEqual({ ok: false, error: 'error-inesperado' })
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })

  it('obtener-seleccion devuelve la seleccion o null', async () => {
    const vacio = preparar()
    expect(await vacio.invocar(CANALES_OVERLAY.obtenerSeleccion, PROPIO)).toEqual({
      ok: true,
      seleccion: null
    })
    const con = preparar({ seleccion: vi.fn(() => ({ teamId: T1 })) })
    expect(await con.invocar(CANALES_OVERLAY.obtenerSeleccion, PROPIO)).toEqual({
      ok: true,
      seleccion: { teamId: T1 }
    })
  })

  it('cerrar llama al controlador y responde ok', async () => {
    const { controlador, invocar } = preparar()
    expect(await invocar(CANALES_OVERLAY.cerrar, PROPIO, { x: 1 })).toEqual({ ok: true })
    expect(controlador.cerrar).toHaveBeenCalledTimes(1)
  })

  it('ninguna respuesta contiene el token', async () => {
    const { invocar } = preparar()
    const respuestas = [
      await invocar(CANALES_OVERLAY.abrir, PROPIO, { teamId: T1 }),
      await invocar(CANALES_OVERLAY.obtenerSeleccion, PROPIO),
      await invocar(CANALES_OVERLAY.cerrar, PROPIO)
    ]
    expect(JSON.stringify(respuestas).toLowerCase()).not.toContain('token')
  })
})
