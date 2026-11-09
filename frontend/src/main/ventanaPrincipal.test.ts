import { describe, expect, it, vi } from 'vitest'
import { crearVentanaPrincipal, type VentanaDeLaApp } from './ventanaPrincipal'

function ventanaFalsa(estado: { destruida?: boolean; minimizada?: boolean } = {}) {
  return {
    isDestroyed: vi.fn(() => estado.destruida ?? false),
    isMinimized: vi.fn(() => estado.minimizada ?? false),
    showInactive: vi.fn(),
    restore: vi.fn(),
    focus: vi.fn(),
    moveTop: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    show: vi.fn(),
    hide: vi.fn()
  } satisfies VentanaDeLaApp & Record<string, unknown>
}

describe('mostrarSinActivar', () => {
  it('sin ventana la crea y la muestra con showInactive', () => {
    const ventana = ventanaFalsa()
    const crear = vi.fn(() => ventana)
    const principal = crearVentanaPrincipal(crear)

    principal.mostrarSinActivar()

    expect(crear).toHaveBeenCalledTimes(1)
    expect(crear).toHaveBeenCalledWith(false)
    expect(ventana.showInactive).toHaveBeenCalledTimes(1)
    expect(principal.actual()).toBe(ventana)
  })

  it('abrir crea la ventana para mostrarse normalmente', () => {
    const crear = vi.fn(() => ventanaFalsa())
    crearVentanaPrincipal(crear).abrir()
    expect(crear).toHaveBeenCalledWith(true)
  })

  it('con la ventana oculta la muestra con showInactive sin crear otra', () => {
    const ventana = ventanaFalsa()
    const crear = vi.fn(() => ventana)
    const principal = crearVentanaPrincipal(crear)
    principal.abrir()

    principal.mostrarSinActivar()

    expect(crear).toHaveBeenCalledTimes(1)
    expect(ventana.showInactive).toHaveBeenCalledTimes(1)
  })

  it('con la ventana minimizada la muestra sin activarla', () => {
    const ventana = ventanaFalsa({ minimizada: true })
    const principal = crearVentanaPrincipal(() => ventana)
    principal.abrir()

    principal.mostrarSinActivar()

    expect(ventana.showInactive).toHaveBeenCalledTimes(1)
    expect(ventana.focus).not.toHaveBeenCalled()
  })

  it('con la ventana destruida crea una nueva', () => {
    const vieja = ventanaFalsa({ destruida: true })
    const nueva = ventanaFalsa()
    const crear = vi.fn().mockReturnValueOnce(vieja).mockReturnValueOnce(nueva)
    const principal = crearVentanaPrincipal(crear)
    principal.abrir()

    principal.mostrarSinActivar()

    expect(crear).toHaveBeenCalledTimes(2)
    expect(crear).toHaveBeenLastCalledWith(false)
    expect(nueva.showInactive).toHaveBeenCalledTimes(1)
    expect(vieja.showInactive).not.toHaveBeenCalled()
    expect(principal.actual()).toBe(nueva)
  })

  it.each([
    ['sin ventana previa', false],
    ['con ventana minimizada', true]
  ])('nunca activa ni sube la ventana (%s)', (_caso, minimizada) => {
    const ventana = ventanaFalsa({ minimizada })
    const principal = crearVentanaPrincipal(() => ventana)
    if (minimizada) {
      principal.abrir()
    }

    principal.mostrarSinActivar()

    expect(ventana.focus).not.toHaveBeenCalled()
    expect(ventana.moveTop).not.toHaveBeenCalled()
    expect(ventana.setAlwaysOnTop).not.toHaveBeenCalled()
    expect(ventana.show).not.toHaveBeenCalled()
  })
})

describe('actual', () => {
  it('es null antes de abrir y tras destruirse', () => {
    const estado = { destruida: false }
    const ventana = ventanaFalsa(estado)
    const principal = crearVentanaPrincipal(() => ventana)
    expect(principal.actual()).toBeNull()
    principal.abrir()
    expect(principal.actual()).toBe(ventana)
    estado.destruida = true
    expect(principal.actual()).toBeNull()
  })
})
