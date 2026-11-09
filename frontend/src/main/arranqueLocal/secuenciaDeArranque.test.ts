import { describe, expect, it, vi } from 'vitest'
import type { ResultadoDeConfiguracion } from './configuracion'
import type { BackendLanzado, ResultadoDeDocker } from './procesoLocal'
import { rutasDeArranque } from './rutas'
import { crearSecuenciaDeArranque, type DependenciasDeArranque } from './secuenciaDeArranque'

const rutas = rutasDeArranque(String.raw`C:\Datos`, String.raw`C:\Programa\resources`)
const ok: ResultadoDeDocker = { codigo: 0, noEncontrado: false }

type Ajustes = {
  configuracion?: ResultadoDeConfiguracion | Error
  docker?: (argumentos: readonly string[]) => ResultadoDeDocker
  puertoOcupado?: boolean
  migracion?: number | null
  backendTermina?: number | null
  saludable?: () => boolean
}

function armar(ajustes: Ajustes = {}) {
  const pasos: string[] = []
  let reloj = 0
  const detener = vi.fn()
  const lanzados: { argumentos: readonly string[]; detener: ReturnType<typeof vi.fn> }[] = []
  let cerrados = 0

  const dependencias: DependenciasDeArranque = {
    rutas,
    prepararConfiguracion: () => {
      pasos.push('configuracion')
      const resultado = ajustes.configuracion ?? 'existente'
      if (resultado instanceof Error) {
        throw resultado
      }
      return resultado
    },
    ejecutarDocker: async (argumentos) => {
      const clave = argumentos.includes('pg_isready')
        ? 'pg_isready'
        : argumentos.includes('up')
          ? 'up'
          : 'info'
      pasos.push(clave)
      return ajustes.docker?.(argumentos) ?? ok
    },
    puertoRespondiendo: async () => {
      pasos.push('puerto')
      return ajustes.puertoOcupado ?? false
    },
    abrirLog: () => {
      pasos.push('log')
      return {
        descriptor: 3,
        cerrar: () => {
          cerrados += 1
        }
      }
    },
    lanzarBackend: (_opciones, argumentos) => {
      pasos.push(argumentos[0] === 'migrar' ? 'migrar' : 'backend')
      const matar = vi.fn()
      lanzados.push({ argumentos, detener: matar })
      const esMigracion = argumentos[0] === 'migrar'
      const codigo = esMigracion ? (ajustes.migracion === undefined ? 0 : ajustes.migracion) : ajustes.backendTermina
      const terminado: Promise<number | null> =
        codigo === undefined ? new Promise(() => undefined) : Promise.resolve(codigo)
      const lanzado: BackendLanzado = { terminado, detener: matar }
      return lanzado
    },
    saludable: async () => {
      pasos.push('salud')
      return ajustes.saludable?.() ?? true
    },
    dormir: async (ms) => {
      reloj += ms
    },
    ahora: () => reloj
  }
  return { dependencias, pasos, lanzados, detener, cerrados: () => cerrados }
}

describe('secuencia de arranque', () => {
  it('con todo respondiendo devuelve listo y sigue el orden del spec', async () => {
    const { dependencias, pasos } = armar()
    const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
    expect(resultado).toEqual({ tipo: 'listo' })
    expect(pasos).toEqual([
      'configuracion',
      'info',
      'up',
      'pg_isready',
      'puerto',
      'log',
      'migrar',
      'backend',
      'salud'
    ])
  })

  it('el backend se lanza con --con-padre y la migracion con migrar', async () => {
    const { dependencias, lanzados } = armar()
    await crearSecuenciaDeArranque(dependencias).arrancar()
    expect(lanzados.map((l) => l.argumentos)).toEqual([['migrar'], ['--con-padre']])
  })

  it('cierra el descriptor del log despues de lanzar', async () => {
    const { dependencias, cerrados } = armar()
    await crearSecuenciaDeArranque(dependencias).arrancar()
    expect(cerrados()).toBe(1)
  })

  describe('errores', () => {
    it('configuracion incompleta corta antes de tocar docker', async () => {
      const { dependencias, pasos } = armar({ configuracion: 'incompleta' })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'configuracion-incompleta' })
      expect(pasos).toEqual(['configuracion'])
    })

    it('un fallo al escribir la configuracion es un error tipado', async () => {
      const { dependencias, pasos } = armar({ configuracion: new Error('EACCES') })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'configuracion-ilegible' })
      expect(pasos).toEqual(['configuracion'])
    })

    it('docker no encontrado', async () => {
      const { dependencias, pasos } = armar({
        docker: () => ({ codigo: null, noEncontrado: true })
      })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'docker-no-encontrado' })
      expect(pasos).toEqual(['configuracion', 'info'])
    })

    it('docker info con codigo distinto de 0', async () => {
      const { dependencias, pasos } = armar({ docker: () => ({ codigo: 1, noEncontrado: false }) })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'docker-detenido' })
      expect(pasos).not.toContain('up')
    })

    it('pg_isready sin exito en 30 segundos', async () => {
      const { dependencias, pasos } = armar({
        docker: (argumentos) =>
          argumentos.includes('pg_isready') ? { codigo: 2, noEncontrado: false } : ok
      })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'base-no-responde' })
      expect(pasos).not.toContain('puerto')
      expect(pasos.filter((p) => p === 'pg_isready').length).toBeGreaterThan(1)
    })

    it('pg_isready que responde despues de unos intentos sigue adelante', async () => {
      let intentos = 0
      const { dependencias } = armar({
        docker: (argumentos) => {
          if (!argumentos.includes('pg_isready')) {
            return ok
          }
          intentos += 1
          return intentos < 4 ? { codigo: 2, noEncontrado: false } : ok
        }
      })
      expect(await crearSecuenciaDeArranque(dependencias).arrancar()).toEqual({ tipo: 'listo' })
      expect(intentos).toBe(4)
    })

    it('up -d db que falla es base-no-responde', async () => {
      const { dependencias, pasos } = armar({
        docker: (argumentos) => (argumentos.includes('up') ? { codigo: 1, noEncontrado: false } : ok)
      })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'base-no-responde' })
      expect(pasos).not.toContain('pg_isready')
    })

    it('puerto 8001 respondiendo antes de lanzar', async () => {
      const { dependencias, pasos, lanzados } = armar({ puertoOcupado: true })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'puerto-ocupado' })
      expect(lanzados).toEqual([])
      expect(pasos).not.toContain('log')
    })

    it('migrar con codigo 1 no lanza el backend', async () => {
      const { dependencias, pasos, cerrados } = armar({ migracion: 1 })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'migracion-fallida' })
      expect(pasos).not.toContain('backend')
      expect(cerrados()).toBe(1)
    })

    it('migrar que no puede arrancar tambien es migracion-fallida', async () => {
      const { dependencias } = armar({ migracion: null })
      expect(await crearSecuenciaDeArranque(dependencias).arrancar()).toEqual({
        tipo: 'error',
        error: 'migracion-fallida'
      })
    })

    it('backend que termina antes de /api/health', async () => {
      const { dependencias } = armar({ backendTermina: 3, saludable: () => false })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'backend-se-cerro' })
    })

    it('/api/health sin 200 en 30 segundos detiene el backend que lanzo', async () => {
      const { dependencias, lanzados } = armar({ saludable: () => false })
      const resultado = await crearSecuenciaDeArranque(dependencias).arrancar()
      expect(resultado).toEqual({ tipo: 'error', error: 'backend-no-responde' })
      const backend = lanzados[1]
      expect(backend?.detener).toHaveBeenCalledTimes(1)
    })
  })

  describe('detener', () => {
    it('mata solo el backend lanzado por la secuencia', async () => {
      const { dependencias, lanzados } = armar()
      const secuencia = crearSecuenciaDeArranque(dependencias)
      await secuencia.arrancar()
      secuencia.detener()
      expect(lanzados[0]?.detener).not.toHaveBeenCalled()
      expect(lanzados[1]?.detener).toHaveBeenCalledTimes(1)
    })

    it('no hace nada si no lanzo ninguno', async () => {
      const { dependencias, lanzados } = armar({ puertoOcupado: true })
      const secuencia = crearSecuenciaDeArranque(dependencias)
      await secuencia.arrancar()
      expect(() => secuencia.detener()).not.toThrow()
      expect(lanzados).toEqual([])
    })

    it('detener dos veces solo mata una vez', async () => {
      const { dependencias, lanzados } = armar()
      const secuencia = crearSecuenciaDeArranque(dependencias)
      await secuencia.arrancar()
      secuencia.detener()
      secuencia.detener()
      expect(lanzados[1]?.detener).toHaveBeenCalledTimes(1)
    })
  })
})
