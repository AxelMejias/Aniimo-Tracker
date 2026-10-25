import { writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, screen, session } from 'electron'
import { crearClienteAmigos } from './amigos/clienteAmigos'
import { registrarManejadoresDeAmigos } from './amigos/ipcAmigos'
import { crearClienteCalculo } from './calculo/clienteCalculo'
import { registrarManejadoresDeCalculo } from './calculo/ipcCalculo'
import { crearClienteBackend } from './auth/clienteBackend'
import { registrarManejadoresDeAuth } from './auth/ipcAuth'
import { crearSesionEnMemoria } from './auth/sesionEnMemoria'
import { guardarLimites, leerLimites } from './overlay/almacenDeLimites'
import { crearControladorOverlay, type ControladorOverlay } from './overlay/controladorOverlay'
import { registrarManejadoresDeOverlay } from './overlay/ipcOverlay'
import { getOverlayWindowOptions } from './overlay/opcionesDeVentana'
import { crearClienteTeams } from './teams/clienteTeams'
import { registrarManejadoresDeTeams } from './teams/ipcTeams'
import type { VentanaOverlay } from './overlay/controladorOverlay'
import type { Rect } from './overlay/limites'
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

function crearVentanaDeOverlay(limites: Rect): VentanaOverlay {
  const ventana = new BrowserWindow(getOverlayWindowOptions(preloadPath, limites))
  ventana.once('ready-to-show', () => ventana.show())

  if (isDev) {
    void ventana.loadURL(`${appUrl}#overlay`)
  } else {
    void ventana.loadFile(appUrl, { hash: 'overlay' })
  }

  return ventana
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
  registrarManejadoresDeAmigos(ipcMain, crearClienteAmigos(fetch, sesion), allowedAppUrl)
  registrarManejadoresDeCalculo(ipcMain, crearClienteCalculo(fetch, sesion), allowedAppUrl)

  const rutaDeLimites = join(app.getPath('userData'), 'overlay.json')
  const controlador: ControladorOverlay = crearControladorOverlay({
    crearVentana: crearVentanaDeOverlay,
    leerLimites: () => leerLimites(rutaDeLimites, (ruta) => readFile(ruta, 'utf8')),
    guardarLimites: async (limites) =>
      guardarLimites(rutaDeLimites, limites, async (ruta, contenido) => {
        writeFileSync(ruta, contenido, 'utf8')
      }),
    areasDePantalla: () => ({
      areas: screen.getAllDisplays().map((pantalla) => pantalla.workArea),
      principal: screen.getPrimaryDisplay().workArea
    }),
    haySesion: () => sesion.obtener() !== null
  })
  sesion.alBorrar(() => controlador.cerrar())
  registrarManejadoresDeOverlay(ipcMain, controlador, allowedAppUrl)

  const ventanaPrincipal = createMainWindow()
  ventanaPrincipal.on('closed', () => controlador.cerrar())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().on('closed', () => controlador.cerrar())
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
