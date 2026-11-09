import { describe, expect, it } from 'vitest'
import { argumentosDeCompose, ARGUMENTOS_DE_INFO } from './argumentosDeDocker'
import { rutasDeArranque } from './rutas'

const rutas = rutasDeArranque(String.raw`C:\Datos\Aniimo Team Tracker`, String.raw`C:\Programa\resources`)

describe('argumentosDeCompose', () => {
  it('levantar-db usa el proyecto aniimo-app, el compose de recursos y el env de datos', () => {
    expect(argumentosDeCompose(rutas, 'levantar-db')).toEqual([
      'compose',
      '-p',
      'aniimo-app',
      '-f',
      String.raw`C:\Programa\resources\docker-compose.app.yml`,
      '--env-file',
      String.raw`C:\Datos\Aniimo Team Tracker\compose.env`,
      'up',
      '-d',
      'db'
    ])
  })

  it('preguntar-db ejecuta pg_isready dentro de db', () => {
    const argumentos = argumentosDeCompose(rutas, 'preguntar-db')
    expect(argumentos.slice(0, 7)).toEqual(argumentosDeCompose(rutas, 'levantar-db').slice(0, 7))
    expect(argumentos.slice(7)).toEqual([
      'exec',
      '-T',
      'db',
      'pg_isready',
      '-U',
      'aniimo',
      '-d',
      'aniimo'
    ])
  })

  it('ningun argumento contiene la contrasena ni usa el compose de desarrollo', () => {
    for (const accion of ['levantar-db', 'preguntar-db'] as const) {
      const texto = argumentosDeCompose(rutas, accion).join(' ')
      expect(texto).not.toContain('POSTGRES_PASSWORD')
      expect(texto).not.toContain('docker-compose.yml')
    }
  })

  it('docker info no lleva mas argumentos', () => {
    expect(ARGUMENTOS_DE_INFO).toEqual(['info'])
  })
})
