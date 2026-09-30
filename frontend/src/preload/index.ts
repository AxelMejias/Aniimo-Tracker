import { contextBridge } from 'electron'
import { buildExposedApi } from './api'

contextBridge.exposeInMainWorld('aniimo', buildExposedApi())
