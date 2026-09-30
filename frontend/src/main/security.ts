import type { BrowserWindowConstructorOptions } from 'electron'

export function getMainWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: preloadPath
    }
  }
}

export function isAllowedNavigation(targetUrl: string, appUrl: string): boolean {
  let target: URL
  let app: URL
  try {
    target = new URL(targetUrl)
    app = new URL(appUrl)
  } catch {
    return false
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:' && target.protocol !== 'file:') {
    return false
  }

  if (app.protocol === 'file:') {
    return target.protocol === 'file:' && target.pathname === app.pathname
  }

  return target.origin === app.origin
}

export function denyWindowOpen(): { action: 'deny' } {
  return { action: 'deny' }
}

export function denyPermission(): false {
  return false
}
