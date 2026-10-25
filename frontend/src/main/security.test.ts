import { describe, expect, it } from 'vitest'
import {
  denyPermission,
  denyWindowOpen,
  getMainWindowOptions,
  getWebPreferences,
  isAllowedNavigation
} from './security'

describe('getWebPreferences', () => {
  it('devuelve las cuatro opciones de endurecimiento y el preload', () => {
    expect(getWebPreferences('/p/preload.js')).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: '/p/preload.js'
    })
  })

  it('usa el preload recibido', () => {
    expect(getWebPreferences('/otro.js').preload).toBe('/otro.js')
  })

  it('es la fuente de las webPreferences de la ventana principal', () => {
    expect(getMainWindowOptions('/p/preload.js').webPreferences).toEqual(
      getWebPreferences('/p/preload.js')
    )
  })
})

describe('getMainWindowOptions', () => {
  const options = getMainWindowOptions('/path/to/preload.js')

  it('hardens webPreferences with the required flags', () => {
    expect(options.webPreferences?.contextIsolation).toBe(true)
    expect(options.webPreferences?.nodeIntegration).toBe(false)
    expect(options.webPreferences?.sandbox).toBe(true)
    expect(options.webPreferences?.webSecurity).toBe(true)
    expect(options.webPreferences?.preload).toBe('/path/to/preload.js')
  })

  it('does not enable insecure integrations', () => {
    expect(options.webPreferences?.nodeIntegrationInWorker).not.toBe(true)
    expect(options.webPreferences?.nodeIntegrationInSubFrames).not.toBe(true)
    expect(options.webPreferences?.webviewTag).not.toBe(true)
    expect(options.webPreferences?.allowRunningInsecureContent).not.toBe(true)
  })
})

describe('isAllowedNavigation', () => {
  const devServerUrl = 'http://localhost:5173'
  const builtIndexUrl = 'file:///C:/Program%20Files/Aniimo/resources/app/out/renderer/index.html'

  it('allows navigation within the dev server origin', () => {
    expect(isAllowedNavigation('http://localhost:5173/pages/home', devServerUrl)).toBe(true)
  })

  it('allows navigation to the packaged index.html', () => {
    expect(isAllowedNavigation(builtIndexUrl, builtIndexUrl)).toBe(true)
  })

  it('acepta como remitente la URL del overlay con hash en dev y en file', () => {
    expect(isAllowedNavigation(`${devServerUrl}/#overlay`, devServerUrl)).toBe(true)
    expect(isAllowedNavigation(`${builtIndexUrl}#overlay`, builtIndexUrl)).toBe(true)
  })

  it('blocks an external https origin', () => {
    expect(isAllowedNavigation('https://example.com', devServerUrl)).toBe(false)
  })

  it('blocks a different local port', () => {
    expect(isAllowedNavigation('http://localhost:9999', devServerUrl)).toBe(false)
  })

  it('blocks javascript: scheme', () => {
    expect(isAllowedNavigation('javascript:alert(1)', devServerUrl)).toBe(false)
  })

  it('blocks data: scheme', () => {
    expect(isAllowedNavigation('data:text/html,hola', devServerUrl)).toBe(false)
  })

  it('blocks an unrelated file:// path even with the packaged app URL', () => {
    expect(isAllowedNavigation('file:///C:/Windows/System32/cmd.exe', builtIndexUrl)).toBe(false)
  })
})

describe('denyWindowOpen', () => {
  it('always denies', () => {
    expect(denyWindowOpen()).toEqual({ action: 'deny' })
  })
})

describe('denyPermission', () => {
  it('deniega display-capture y media por ser incondicional', () => {
    for (const permiso of ['display-capture', 'media']) {
      expect((denyPermission as (p?: string) => false)(permiso)).toBe(false)
    }
  })

  it('always denies', () => {
    expect(denyPermission()).toBe(false)
  })
})
