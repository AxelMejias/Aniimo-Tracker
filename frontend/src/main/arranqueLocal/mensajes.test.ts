import { describe, expect, it } from 'vitest'
import { mensajeDeError } from './mensajes'
import type { ErrorDeArranque } from './secuenciaDeArranque'

const LOG = String.raw`C:\Datos\Aniimo Team Tracker\logs\backend.log`
const DATOS = String.raw`C:\Datos\Aniimo Team Tracker`

const TODOS: ErrorDeArranque[] = [
  'configuracion-incompleta',
  'configuracion-ilegible',
  'docker-no-encontrado',
  'docker-detenido',
  'base-no-responde',
  'puerto-ocupado',
  'migracion-fallida',
  'backend-se-cerro',
  'backend-no-responde'
]

describe('mensajeDeError', () => {
  it.each(TODOS)('%s tiene titulo y texto en castellano con una accion', (error) => {
    const { titulo, texto } = mensajeDeError(error, LOG, DATOS)
    expect(titulo.length).toBeGreaterThan(5)
    expect(texto.length).toBeGreaterThan(30)
  })

  it('docker no encontrado pide instalar Docker Desktop', () => {
    expect(mensajeDeError('docker-no-encontrado', LOG, DATOS).texto).toContain('Instalá Docker Desktop')
  })

  it('docker detenido pide abrir Docker Desktop y esperar', () => {
    const { texto } = mensajeDeError('docker-detenido', LOG, DATOS)
    expect(texto).toContain('Abrí Docker Desktop')
    expect(texto).toContain('esperá')
  })

  it('puerto ocupado nombra el 8001', () => {
    expect(mensajeDeError('puerto-ocupado', LOG, DATOS).texto).toContain('8001')
  })

  it.each(['migracion-fallida', 'backend-se-cerro', 'backend-no-responde'] as const)(
    '%s incluye la ruta del log',
    (error) => {
      expect(mensajeDeError(error, LOG, DATOS).texto).toContain(LOG)
    }
  )

  it('configuracion incompleta indica la carpeta de datos y el README', () => {
    const { texto } = mensajeDeError('configuracion-incompleta', LOG, DATOS)
    expect(texto).toContain(DATOS)
    expect(texto).toContain('README')
  })

  it.each(TODOS)('%s no menciona contrasenas ni variables de entorno', (error) => {
    const { titulo, texto } = mensajeDeError(error, LOG, DATOS)
    const junto = `${titulo} ${texto}`
    expect(junto).not.toContain('POSTGRES_PASSWORD')
    expect(junto).not.toContain('DATABASE_URL')
  })
})
