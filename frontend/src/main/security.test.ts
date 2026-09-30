import { describe, expect, it } from 'vitest'
import {
  denyPermission,
  denyWindowOpen,
  getMainWindowOptions,
  isAllowedNavigation
} from './security'

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
  it('always denies', () => {
    expect(denyPermission()).toBe(false)
  })
})
