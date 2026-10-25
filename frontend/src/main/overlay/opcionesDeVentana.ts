import type { BrowserWindowConstructorOptions } from 'electron'
import { getWebPreferences } from '../security'
import { ALTO_MINIMO, ANCHO_MINIMO, type Rect } from './limites'

export function getOverlayWindowOptions(
  preloadPath: string,
  limites: Rect
): BrowserWindowConstructorOptions {
  return {
    ...limites,
    minWidth: ANCHO_MINIMO,
    minHeight: ALTO_MINIMO,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    title: 'Aniimo Overlay',
    webPreferences: getWebPreferences(preloadPath)
  }
}
