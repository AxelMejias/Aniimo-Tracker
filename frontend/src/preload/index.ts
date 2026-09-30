import { contextBridge, ipcRenderer } from 'electron'
import { buildExposedApi } from './api'

contextBridge.exposeInMainWorld(
  'aniimo',
  buildExposedApi((canal, ...args) => ipcRenderer.invoke(canal, ...args))
)
