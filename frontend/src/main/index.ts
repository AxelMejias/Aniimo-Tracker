import { writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, screen, session, Tray } from 'electron'
import { iniciarApp } from './arranqueLocal/iniciarApp'
import { mensajeDeError } from './arranqueLocal/mensajes'
import { rutasDeArranque } from './arranqueLocal/rutas'
import { crearSecuenciaReal } from './arranqueLocal/secuenciaReal'
import { crearClienteAmigos } from './amigos/clienteAmigos'
import { registrarManejadoresDeAmigos } from './amigos/ipcAmigos'
import { crearClienteCalculo } from './calculo/clienteCalculo'
import { registrarManejadoresDeCalculo } from './calculo/ipcCalculo'
import { crearClienteBackend } from './auth/clienteBackend'
import { registrarManejadoresDeAuth } from './auth/ipcAuth'
import { crearSesionEnMemoria } from './auth/sesionEnMemoria'
import { registrarManejadoresDePreferencias } from './deteccionJuego/ipcPreferencias'
import { estaCorriendo } from './deteccionJuego/listaDeProcesos'
import { NOMBRES_DEL_JUEGO } from './deteccionJuego/nombresDelJuego'
import { guardarPreferencias, leerPreferencias } from './deteccionJuego/preferencias'
import {
  ARGUMENTO_SEGUNDO_PLANO,
  arrancaEnSegundoPlano,
  crearSegundoPlano
} from './deteccionJuego/segundoPlano'
import { crearServicioDePreferencias } from './deteccionJuego/servicioDePreferencias'
import { crearVigia } from './deteccionJuego/vigiaDelJuego'
import { guardarLimites, leerLimites } from './overlay/almacenDeLimites'
import { crearClienteGrupos } from './grupos/clienteGrupos'
import { registrarManejadoresDeGrupos } from './grupos/ipcGrupos'
import { crearControladorOverlay, type ControladorOverlay } from './overlay/controladorOverlay'
import { registrarManejadoresDeOverlay } from './overlay/ipcOverlay'
import { getOverlayWindowOptions } from './overlay/opcionesDeVentana'
import { urlBaseDelBackend } from './backend/peticion'
import { quitarMenuDeLaAplicacion } from './menu'
import { crearVentanaPrincipal } from './ventanaPrincipal'
import { crearClienteTeams } from './teams/clienteTeams'
import { registrarManejadoresDeTeams } from './teams/ipcTeams'
import type { VentanaOverlay } from './overlay/controladorOverlay'
import type { Rect } from './overlay/limites'
import {
  denyPermission,
  denyWindowOpen,
  getMainWindowOptions,
  isAllowedNavigation
} from './security'

const isDev = !app.isPackaged
const preloadPath = join(__dirname, '../preload/index.js')
const appUrl = isDev ? 'http://localhost:5173' : join(__dirname, '../renderer/index.html')
const allowedAppUrl = isDev ? appUrl : pathToFileURL(appUrl).href
const arranquePath = join(__dirname, '../renderer/arranque.html')
const esLaUnicaInstancia = isDev || app.requestSingleInstanceLock()

if (!esLaUnicaInstancia) {
  app.quit()
}

function createMainWindow(mostrar: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: 1024,
    height: 768,
    show: mostrar,
    ...getMainWindowOptions(preloadPath)
  })

  if (isDev) {
    void window.loadURL(appUrl)
  } else {
    void window.loadFile(appUrl)
  }

  return window
}

function crearVentanaDeArranque(): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 420,
    height: 220,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    // Sin preload: la pagina es estatica y no usa IPC.
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })
  void ventana.loadFile(arranquePath)
  return ventana
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

app.whenReady().then(async () => {
  if (!esLaUnicaInstancia) {
    return
  }
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(denyPermission())
  })

  quitarMenuDeLaAplicacion(Menu, app.isPackaged)

  const sesion = crearSesionEnMemoria()
  const urlBase = urlBaseDelBackend(app.isPackaged)
  registrarManejadoresDeAuth(ipcMain, crearClienteBackend(fetch, sesion, urlBase), allowedAppUrl)
  registrarManejadoresDeTeams(ipcMain, crearClienteTeams(fetch, sesion, urlBase), allowedAppUrl)
  registrarManejadoresDeGrupos(ipcMain, crearClienteGrupos(fetch, sesion, urlBase), allowedAppUrl)
  registrarManejadoresDeAmigos(ipcMain, crearClienteAmigos(fetch, sesion, urlBase), allowedAppUrl)
  registrarManejadoresDeCalculo(ipcMain, crearClienteCalculo(fetch, sesion, urlBase), allowedAppUrl)

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

  let ventanaDeArranque: BrowserWindow | null = null
  let principalLista = false
  let mostrarAlTerminar = false
  let bandeja: Tray | null = null

  const carpetaDeDatos = app.getPath('userData')
  const secuencia = crearSecuenciaReal(carpetaDeDatos, process.resourcesPath)
  const rutas = rutasDeArranque(carpetaDeDatos, process.resourcesPath)
  app.on('will-quit', () => secuencia.detener())

  const traerAlFrente = (): void => {
    if (!principalLista) {
      return
    }
    const ventana = principal.actual() ?? principal.abrir()
    if (ventana.isMinimized()) {
      ventana.restore()
    }
    ventana.show()
    ventana.focus()
  }

  const segundoPlano = crearSegundoPlano({
    empaquetado: app.isPackaged,
    inicioDeWindows: {
      leer: () => app.getLoginItemSettings({ args: [ARGUMENTO_SEGUNDO_PLANO] }).openAtLogin,
      poner: (opciones) => app.setLoginItemSettings(opciones)
    },
    crearIcono: (items) => {
      void app.getFileIcon(process.execPath).then((icono) => {
        bandeja = new Tray(icono)
        bandeja.setToolTip('Aniimo Team Tracker')
        bandeja.setContextMenu(
          Menu.buildFromTemplate(items.map((item) => ({ label: item.etiqueta, click: item.alElegir })))
        )
        bandeja.on('click', traerAlFrente)
      })
    },
    mostrarPrincipal: traerAlFrente,
    detener: () => secuencia.detener(),
    salir: () => app.quit()
  })

  const principal = crearVentanaPrincipal((mostrar) => {
    const ventana = createMainWindow(mostrar)
    ventana.on('close', (evento) => segundoPlano.alCerrarVentana(evento, ventana))
    ventana.on('closed', () => controlador.cerrar())
    return ventana
  })

  const abrirPrincipal = (): void => {
    principal.abrir()
    principalLista = true
    ventanaDeArranque?.close()
    ventanaDeArranque = null
  }

  const vigia = crearVigia({
    consultar: () => estaCorriendo(NOMBRES_DEL_JUEGO[0]),
    alAbrirse: () => {
      if (principalLista) {
        principal.mostrarSinActivar()
      } else {
        mostrarAlTerminar = true
      }
    }
  })

  const rutaDePreferencias = join(app.getPath('userData'), 'preferencias.json')
  const servicioDePreferencias = crearServicioDePreferencias({
    leerGuardadas: () => leerPreferencias(rutaDePreferencias, (ruta) => readFile(ruta, 'utf8')),
    guardar: (preferencias) =>
      guardarPreferencias(rutaDePreferencias, preferencias, async (ruta, contenido) => {
        writeFileSync(ruta, contenido, 'utf8')
      }),
    vigia,
    segundoPlano: {
      disponible: segundoPlano.disponible,
      leerInicio: segundoPlano.leerInicio,
      ponerInicio: segundoPlano.ponerInicio
    }
  })
  registrarManejadoresDePreferencias(ipcMain, servicioDePreferencias, allowedAppUrl)

  app.on('second-instance', traerAlFrente)

  app.on('activate', () => {
    if (principalLista && BrowserWindow.getAllWindows().length === 0) {
      principal.abrir()
    }
  })

  app.on('before-quit', () => segundoPlano.marcarSaliendo())

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && segundoPlano.debeSalirAlCerrarTodo()) {
      app.quit()
    }
  })

  const enSegundoPlano = arrancaEnSegundoPlano(process.argv, app.isPackaged)
  if (enSegundoPlano || segundoPlano.leerInicio()) {
    segundoPlano.asegurarIcono()
  }
  void servicioDePreferencias.iniciar()

  await iniciarApp({
    empaquetado: app.isPackaged,
    secuencia,
    mostrarArranque: () => {
      if (ventanaDeArranque === null || ventanaDeArranque.isDestroyed()) {
        ventanaDeArranque = crearVentanaDeArranque()
      } else {
        ventanaDeArranque.show()
      }
    },
    ocultarArranque: () => ventanaDeArranque?.hide(),
    preguntar: async (error) => {
      const { titulo, texto } = mensajeDeError(error, rutas.log, carpetaDeDatos)
      const { response } = await dialog.showMessageBox({
        type: 'error',
        title: 'Aniimo Team Tracker',
        message: titulo,
        detail: texto,
        buttons: ['Reintentar', 'Salir'],
        defaultId: 0,
        cancelId: 1
      })
      return response === 0 ? 'reintentar' : 'salir'
    },
    abrirPrincipal,
    salir: () => app.quit(),
    ...(enSegundoPlano
      ? {
          segundoPlano: {
            alListo: () => {
              principalLista = true
              if (mostrarAlTerminar) {
                principal.mostrarSinActivar()
              }
            },
            dormir: (milisegundos: number) =>
              new Promise<void>((resolver) => setTimeout(resolver, milisegundos)),
            ahora: () => Date.now()
          }
        }
      : {})
  })
})
