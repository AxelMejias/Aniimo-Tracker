import { win32 } from 'node:path'

export type RutasDeArranque = {
  readonly composeEnv: string
  readonly carpetaDelBackend: string
  readonly backendEnv: string
  readonly carpetaDeLogs: string
  readonly log: string
  readonly logAnterior: string
  readonly compose: string
  readonly backendExe: string
}

export function rutasDeArranque(userData: string, resourcesPath: string): RutasDeArranque {
  const carpetaDelBackend = win32.join(userData, 'backend')
  const carpetaDeLogs = win32.join(userData, 'logs')
  return {
    composeEnv: win32.join(userData, 'compose.env'),
    carpetaDelBackend,
    backendEnv: win32.join(carpetaDelBackend, '.env'),
    carpetaDeLogs,
    log: win32.join(carpetaDeLogs, 'backend.log'),
    logAnterior: win32.join(carpetaDeLogs, 'backend.anterior.log'),
    compose: win32.join(resourcesPath, 'docker-compose.app.yml'),
    backendExe: win32.join(resourcesPath, 'aniimo-backend', 'aniimo-backend.exe')
  }
}
