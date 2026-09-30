import { join } from 'node:path'
import { app, BrowserWindow, session } from 'electron'
import { denyPermission, denyWindowOpen, getMainWindowOptions, isAllowedNavigation } from './security'

const isDev = !app.isPackaged
const preloadPath = join(__dirname, '../preload/index.js')
const appUrl = isDev ? 'http://localhost:5173' : join(__dirname, '../renderer/index.html')

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
    if (!isAllowedNavigation(targetUrl, isDev ? appUrl : `file://${appUrl}`)) {
      navigationEvent.preventDefault()
    }
  })

  contents.on('will-redirect', (navigationEvent, targetUrl) => {
    if (!isAllowedNavigation(targetUrl, isDev ? appUrl : `file://${appUrl}`)) {
      navigationEvent.preventDefault()
    }
  })

  contents.setWindowOpenHandler(denyWindowOpen)
})

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(denyPermission())
  })

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
