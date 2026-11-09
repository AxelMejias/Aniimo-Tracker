import type { RutasDeArranque } from './rutas'

export const PROYECTO_DE_COMPOSE = 'aniimo-app'
export const ARGUMENTOS_DE_INFO: readonly string[] = ['info']

export type AccionDeCompose = 'levantar-db' | 'preguntar-db'

export function argumentosDeCompose(rutas: RutasDeArranque, accion: AccionDeCompose): string[] {
  const base = [
    'compose',
    '-p',
    PROYECTO_DE_COMPOSE,
    '-f',
    rutas.compose,
    '--env-file',
    rutas.composeEnv
  ]
  if (accion === 'levantar-db') {
    return [...base, 'up', '-d', 'db']
  }
  return [...base, 'exec', '-T', 'db', 'pg_isready', '-U', 'aniimo', '-d', 'aniimo']
}
