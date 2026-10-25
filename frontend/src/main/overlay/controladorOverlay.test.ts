import { describe, expect, it, vi } from 'vitest'
import { crearControladorOverlay, type VentanaOverlay } from './controladorOverlay'
import type { Rect } from './limites'

const T1 = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'
const T2 = '7a1d3c52-6b0e-4f3a-8d21-5c9e4b7a0f11'
const PRINCIPAL: Rect = { x: 0, y: 0, width: 1920, height: 1040 }

function ventanaFalsa(bounds: Rect = { x: 50, y: 60, width: 400, height: 600 }) {
  const oyentes = new Map<string, () => void>()
  const ventana = {
    show: vi.fn(),
    focus: vi.fn(),
    getBounds: vi.fn(() => bounds),
    on: vi.fn((evento: 'close' | 'closed', oyente: () => void) => {
      oyentes.set(evento, oyente)
    }),
    close: vi.fn(() => {
      oyentes.get('close')?.()
      oyentes.get('closed')?.()
    })
  } satisfies VentanaOverlay
  return { ventana, emitir: (evento: string) => oyentes.get(evento)?.() }
}

function preparar(
  opciones: {
    haySesion?: boolean
    limites?: Rect | null
    guardar?: (r: Rect) => Promise<void>
  } = {}
) {
  const ventanas: ReturnType<typeof ventanaFalsa>[] = []
  const crearVentana = vi.fn<(limites: Rect) => VentanaOverlay>(() => {
    const nueva = ventanaFalsa()
    ventanas.push(nueva)
    return nueva.ventana
  })
  const guardarLimites = vi.fn(opciones.guardar ?? (async () => undefined))
  const controlador = crearControladorOverlay({
    crearVentana,
    leerLimites: async () => opciones.limites ?? null,
    guardarLimites,
    areasDePantalla: () => ({ areas: [PRINCIPAL], principal: PRINCIPAL }),
    haySesion: () => opciones.haySesion ?? true
  })
  return { controlador, crearVentana, guardarLimites, ventanas }
}

describe('crearControladorOverlay', () => {
  it('primera apertura crea una ventana y guarda la seleccion', async () => {
    const { controlador, crearVentana } = preparar()
    expect(controlador.seleccion()).toBeNull()
    expect(await controlador.abrir(T1)).toEqual({ ok: true })
    expect(crearVentana).toHaveBeenCalledTimes(1)
    expect(controlador.seleccion()).toEqual({ teamId: T1 })
  })

  it('abrir con el overlay abierto no crea otra ventana y la trae al frente', async () => {
    const { controlador, crearVentana, ventanas } = preparar()
    await controlador.abrir(T1)
    await controlador.abrir(T2)
    expect(crearVentana).toHaveBeenCalledTimes(1)
    expect(controlador.seleccion()).toEqual({ teamId: T2 })
    expect(ventanas[0].ventana.show).toHaveBeenCalledTimes(1)
    expect(ventanas[0].ventana.focus).toHaveBeenCalledTimes(1)
  })

  it('dos aperturas simultaneas crean una sola ventana', async () => {
    const { controlador, crearVentana } = preparar()
    await Promise.all([controlador.abrir(T1), controlador.abrir(T2)])
    expect(crearVentana).toHaveBeenCalledTimes(1)
    expect(controlador.seleccion()).toEqual({ teamId: T2 })
  })

  it('sin sesion responde sesion-vencida y no crea ventana', async () => {
    const { controlador, crearVentana } = preparar({ haySesion: false })
    expect(await controlador.abrir(T1)).toEqual({ ok: false, error: 'sesion-vencida' })
    expect(crearVentana).not.toHaveBeenCalled()
    expect(controlador.seleccion()).toBeNull()
  })

  it('cerrar cierra la ventana, borra la seleccion y reabrir crea otra', async () => {
    const { controlador, crearVentana, ventanas } = preparar()
    await controlador.abrir(T1)
    controlador.cerrar()
    expect(ventanas[0].ventana.close).toHaveBeenCalledTimes(1)
    expect(controlador.seleccion()).toBeNull()
    await controlador.abrir(T2)
    expect(crearVentana).toHaveBeenCalledTimes(2)
  })

  it('cerrar es idempotente y no falla sin ventana', async () => {
    const { controlador, ventanas } = preparar()
    expect(() => controlador.cerrar()).not.toThrow()
    await controlador.abrir(T1)
    controlador.cerrar()
    controlador.cerrar()
    expect(ventanas[0].ventana.close).toHaveBeenCalledTimes(1)
  })

  it('lee los limites guardados y los ajusta a las pantallas al crear', async () => {
    const guardado = { x: 100, y: 100, width: 400, height: 500 }
    const dentro = preparar({ limites: guardado })
    await dentro.controlador.abrir(T1)
    expect(dentro.crearVentana).toHaveBeenCalledWith(guardado)

    const fuera = preparar({ limites: { x: 5000, y: 100, width: 400, height: 500 } })
    await fuera.controlador.abrir(T1)
    expect(fuera.crearVentana).toHaveBeenCalledWith({ x: 780, y: 260, width: 360, height: 520 })
  })

  it('al cerrar guarda los limites actuales de la ventana', async () => {
    const { controlador, guardarLimites } = preparar()
    await controlador.abrir(T1)
    controlador.cerrar()
    expect(guardarLimites).toHaveBeenCalledWith({ x: 50, y: 60, width: 400, height: 600 })
  })

  it('un cierre iniciado por la propia ventana tambien guarda y limpia', async () => {
    const { controlador, guardarLimites, ventanas } = preparar()
    await controlador.abrir(T1)
    ventanas[0].emitir('close')
    ventanas[0].emitir('closed')
    expect(guardarLimites).toHaveBeenCalledTimes(1)
    expect(controlador.seleccion()).toBeNull()
  })

  it('un error al guardar no impide cerrar', async () => {
    const { controlador, ventanas } = preparar({
      guardar: async () => {
        throw new Error('EACCES')
      }
    })
    await controlador.abrir(T1)
    expect(() => controlador.cerrar()).not.toThrow()
    expect(ventanas[0].ventana.close).toHaveBeenCalled()
    await Promise.resolve()
  })

  it('el closed de una ventana vieja no limpia la ventana nueva', async () => {
    const { controlador, ventanas } = preparar()
    await controlador.abrir(T1)
    controlador.cerrar()
    await controlador.abrir(T2)
    ventanas[0].emitir('closed')
    expect(controlador.seleccion()).toEqual({ teamId: T2 })
  })
})
