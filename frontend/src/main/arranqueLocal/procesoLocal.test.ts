import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import * as modulo from './procesoLocal'
import { ejecutarDocker, lanzarBackend, type ModuloDeProcesos } from './procesoLocal'

class HijoFalso extends EventEmitter {
  readonly kill = vi.fn(() => true)
}

function procesosFalsos(error: { code: number | string } | null = null) {
  const hijo = new HijoFalso()
  const execFile = vi.fn(
    (
      _archivo: string,
      _argumentos: readonly string[],
      _opciones: object,
      alTerminar: (error: { code?: number | string } | null) => void
    ) => {
      alTerminar(error)
      return undefined
    }
  )
  const spawn = vi.fn(() => hijo)
  const procesos = { execFile, spawn } as unknown as ModuloDeProcesos
  return { procesos, execFile, spawn, hijo }
}

describe('procesoLocal', () => {
  it('solo expone ejecutarDocker y lanzarBackend', () => {
    expect(Object.keys(modulo).sort()).toEqual(['ejecutarDocker', 'lanzarBackend'])
  })

  describe('ejecutarDocker', () => {
    it('llama a docker con los argumentos recibidos, sin shell y sin ventana', async () => {
      const { procesos, execFile } = procesosFalsos()
      const resultado = await ejecutarDocker(['compose', '-p', 'aniimo-app', 'up'], procesos)
      expect(execFile).toHaveBeenCalledTimes(1)
      const [archivo, argumentos, opciones] = execFile.mock.calls[0] ?? []
      expect(archivo).toBe('docker')
      expect(argumentos).toEqual(['compose', '-p', 'aniimo-app', 'up'])
      expect(opciones).toMatchObject({ shell: false, windowsHide: true })
      expect(resultado).toEqual({ codigo: 0, noEncontrado: false })
    })

    it('devuelve el codigo de salida cuando docker falla', async () => {
      const { procesos } = procesosFalsos({ code: 1 })
      expect(await ejecutarDocker(['info'], procesos)).toEqual({ codigo: 1, noEncontrado: false })
    })

    it('marca noEncontrado cuando docker no existe', async () => {
      const { procesos } = procesosFalsos({ code: 'ENOENT' })
      expect(await ejecutarDocker(['info'], procesos)).toEqual({
        codigo: null,
        noEncontrado: true
      })
    })
  })

  describe('lanzarBackend', () => {
    const opciones = {
      exe: String.raw`C:\Programa\resources\aniimo-backend\aniimo-backend.exe`,
      carpeta: String.raw`C:\Datos\backend`,
      salida: 7
    }

    it('lanza el exe con cwd, entrada como tuberia y salida al log', () => {
      const { procesos, spawn } = procesosFalsos()
      lanzarBackend(opciones, ['--con-padre'], procesos)
      expect(spawn).toHaveBeenCalledTimes(1)
      const [archivo, argumentos, spawnOpciones] = (spawn.mock.calls[0] ?? []) as unknown as [
        string,
        string[],
        object
      ]
      expect(archivo).toBe(opciones.exe)
      expect(argumentos).toEqual(['--con-padre'])
      expect(spawnOpciones).toEqual({
        cwd: opciones.carpeta,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 7, 7]
      })
    })

    it('migrar recibe solo su argumento', () => {
      const { procesos, spawn } = procesosFalsos()
      lanzarBackend(opciones, ['migrar'], procesos)
      expect((spawn.mock.calls[0] as unknown as [string, string[]])[1]).toEqual(['migrar'])
    })

    it('terminado devuelve el codigo cuando el proceso sale', async () => {
      const { procesos, hijo } = procesosFalsos()
      const backend = lanzarBackend(opciones, ['migrar'], procesos)
      hijo.emit('exit', 0)
      expect(await backend.terminado).toBe(0)
    })

    it('terminado devuelve null si el proceso no pudo arrancar', async () => {
      const { procesos, hijo } = procesosFalsos()
      const backend = lanzarBackend(opciones, ['--con-padre'], procesos)
      hijo.emit('error', new Error('ENOENT'))
      expect(await backend.terminado).toBeNull()
    })

    it('detener mata solo ese proceso', () => {
      const { procesos, hijo } = procesosFalsos()
      const backend = lanzarBackend(opciones, ['--con-padre'], procesos)
      backend.detener()
      expect(hijo.kill).toHaveBeenCalledTimes(1)
    })
  })
})
