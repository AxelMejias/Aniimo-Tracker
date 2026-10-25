import { describe, expect, it } from 'vitest'
import { getMainWindowOptions } from '../security'
import { getOverlayWindowOptions } from './opcionesDeVentana'

const LIMITES = { x: 100, y: 80, width: 360, height: 520 }

describe('getOverlayWindowOptions', () => {
  const opciones = getOverlayWindowOptions('/p/preload.js', LIMITES)

  it('define marco, siempre visible, redimensionable y oculta hasta estar lista', () => {
    expect(opciones).toMatchObject({
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      show: false,
      x: 100,
      y: 80,
      width: 360,
      height: 520
    })
    expect(opciones.minWidth).toBe(280)
    expect(opciones.minHeight).toBe(200)
    expect(opciones.parent).toBeUndefined()
  })

  it('usa los limites recibidos', () => {
    const otras = getOverlayWindowOptions('/p/preload.js', { x: -5, y: 9, width: 400, height: 600 })
    expect(otras).toMatchObject({ x: -5, y: 9, width: 400, height: 600 })
  })

  it('no es transparente ni tiene opacidad', () => {
    expect(opciones.transparent).toBeUndefined()
    expect(opciones.opacity).toBeUndefined()
  })

  it('tiene las mismas webPreferences que la ventana principal', () => {
    expect(opciones.webPreferences).toEqual(getMainWindowOptions('/p/preload.js').webPreferences)
  })

  it('no habilita integraciones inseguras', () => {
    const prefs = opciones.webPreferences
    expect(prefs?.nodeIntegrationInWorker).not.toBe(true)
    expect(prefs?.nodeIntegrationInSubFrames).not.toBe(true)
    expect(prefs?.webviewTag).not.toBe(true)
    expect(prefs?.allowRunningInsecureContent).not.toBe(true)
  })
})
