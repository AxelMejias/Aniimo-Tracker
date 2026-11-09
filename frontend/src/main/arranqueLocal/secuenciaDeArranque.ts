import { argumentosDeCompose, ARGUMENTOS_DE_INFO } from './argumentosDeDocker'
import type { ResultadoDeConfiguracion } from './configuracion'
import type {
  ArgumentosDelBackend,
  BackendLanzado,
  OpcionesDelBackend,
  ResultadoDeDocker
} from './procesoLocal'
import type { RutasDeArranque } from './rutas'

export type ErrorDeArranque =
  | 'configuracion-incompleta'
  | 'configuracion-ilegible'
  | 'docker-no-encontrado'
  | 'docker-detenido'
  | 'base-no-responde'
  | 'puerto-ocupado'
  | 'migracion-fallida'
  | 'backend-se-cerro'
  | 'backend-no-responde'

export type ResultadoDeArranque =
  | { readonly tipo: 'listo' }
  | { readonly tipo: 'error'; readonly error: ErrorDeArranque }

export type LogAbierto = { readonly descriptor: number; readonly cerrar: () => void }

export type DependenciasDeArranque = {
  readonly rutas: RutasDeArranque
  readonly prepararConfiguracion: () => ResultadoDeConfiguracion
  readonly ejecutarDocker: (argumentos: readonly string[]) => Promise<ResultadoDeDocker>
  readonly puertoRespondiendo: () => Promise<boolean>
  readonly abrirLog: () => LogAbierto
  readonly lanzarBackend: (
    opciones: OpcionesDelBackend,
    argumentos: ArgumentosDelBackend
  ) => BackendLanzado
  readonly saludable: () => Promise<boolean>
  readonly dormir: (milisegundos: number) => Promise<void>
  readonly ahora: () => number
}

export type SecuenciaDeArranque = {
  readonly arrancar: () => Promise<ResultadoDeArranque>
  readonly detener: () => void
}

const ESPERA_MAXIMA_MS = 30_000
const PAUSA_ENTRE_INTENTOS_MS = 1_000
const PAUSA_ENTRE_SONDEOS_MS = 500

function fallo(error: ErrorDeArranque): ResultadoDeArranque {
  return { tipo: 'error', error }
}

export function crearSecuenciaDeArranque(deps: DependenciasDeArranque): SecuenciaDeArranque {
  let backend: BackendLanzado | null = null

  async function esperarLaBase(): Promise<boolean> {
    const inicio = deps.ahora()
    const argumentos = argumentosDeCompose(deps.rutas, 'preguntar-db')
    while (deps.ahora() - inicio < ESPERA_MAXIMA_MS) {
      const respuesta = await deps.ejecutarDocker(argumentos)
      if (respuesta.codigo === 0) {
        return true
      }
      await deps.dormir(PAUSA_ENTRE_INTENTOS_MS)
    }
    return false
  }

  async function esperarAlBackend(lanzado: BackendLanzado): Promise<ResultadoDeArranque> {
    let termino = false
    void lanzado.terminado.then(() => {
      termino = true
    })
    const inicio = deps.ahora()
    while (deps.ahora() - inicio < ESPERA_MAXIMA_MS) {
      if (termino) {
        return fallo('backend-se-cerro')
      }
      if (await deps.saludable()) {
        return { tipo: 'listo' }
      }
      await deps.dormir(PAUSA_ENTRE_SONDEOS_MS)
    }
    detener()
    return fallo('backend-no-responde')
  }

  async function migrarYLanzar(): Promise<ResultadoDeArranque | BackendLanzado> {
    const log = deps.abrirLog()
    try {
      const opciones = {
        exe: deps.rutas.backendExe,
        carpeta: deps.rutas.carpetaDelBackend,
        salida: log.descriptor
      }
      const migracion = await deps.lanzarBackend(opciones, ['migrar']).terminado
      if (migracion !== 0) {
        return fallo('migracion-fallida')
      }
      return deps.lanzarBackend(opciones, ['--con-padre'])
    } finally {
      log.cerrar()
    }
  }

  async function arrancar(): Promise<ResultadoDeArranque> {
    let configuracion: ResultadoDeConfiguracion
    try {
      configuracion = deps.prepararConfiguracion()
    } catch {
      return fallo('configuracion-ilegible')
    }
    if (configuracion === 'incompleta') {
      return fallo('configuracion-incompleta')
    }

    const info = await deps.ejecutarDocker(ARGUMENTOS_DE_INFO)
    if (info.noEncontrado) {
      return fallo('docker-no-encontrado')
    }
    if (info.codigo !== 0) {
      return fallo('docker-detenido')
    }

    const levantada = await deps.ejecutarDocker(argumentosDeCompose(deps.rutas, 'levantar-db'))
    if (levantada.codigo !== 0 || !(await esperarLaBase())) {
      return fallo('base-no-responde')
    }

    if (await deps.puertoRespondiendo()) {
      return fallo('puerto-ocupado')
    }

    const resultado = await migrarYLanzar()
    if ('tipo' in resultado) {
      return resultado
    }
    backend = resultado
    return esperarAlBackend(resultado)
  }

  function detener(): void {
    const lanzado = backend
    backend = null
    lanzado?.detener()
  }

  return { arrancar, detener }
}
