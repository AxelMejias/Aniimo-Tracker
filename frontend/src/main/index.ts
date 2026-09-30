import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, session } from 'electron'
import { crearClienteBackend } from './auth/clienteBackend'
import { registrarManejadoresDeAuth } from './auth/ipcAuth'
import { crearSesionEnMemoria } from './auth/sesionEnMemoria'
import { crearClienteTeams } from './teams/clienteTeams'
import { registrarManejadoresDeTeams } from './teams/ipcTeams'
import { denyPermission, denyWindowOpen, getMainWindowOptions, isAllowedNavigation } from './security'

const isDev = !app.isPackaged
const preloadPath = join(__dirname, '../preload/index.js')
const appUrl = isDev ? 'http://localhost:5173' : join(__dirname, '../renderer/index.html')
const allowedAppUrl = isDev ? appUrl : pathToFileURL(appUrl).href

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1024,
    height: 768,
    ...getMainWindowOptions(preloadPath)
  })

  if (isDev) {
    void window.loadURL(appUrl)
  } else {
    void window.loadFile(appUrl)
  }

  return window
}

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (navigationEvent, targetUrl) => {
    if (!isAllowedNavigation(targetUrl, allowedAppUrl)) {
      navigationEvent.preventDefault()
    }
  })

  contents.on('will-redirect', (navigationEvent, targetUrl) => {
    if (!isAllowedNavigation(targetUrl, allowedAppUrl)) {
      navigationEvent.preventDefault()
    }
  })

  contents.setWindowOpenHandler(denyWindowOpen)
})

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(denyPermission())
  })

  const sesion = crearSesionEnMemoria()
  registrarManejadoresDeAuth(ipcMain, crearClienteBackend(fetch, sesion), allowedAppUrl)
  registrarManejadoresDeTeams(ipcMain, crearClienteTeams(fetch, sesion), allowedAppUrl)

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
