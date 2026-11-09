import * as procesosDelSistema from 'node:child_process'

type ErrorDeProceso = { readonly code?: number | string } | null

type HijoLanzado = {
  readonly kill: () => boolean
  readonly once: (evento: 'exit' | 'error', alOcurrir: (valor?: unknown) => void) => unknown
}

export type ModuloDeProcesos = {
  readonly execFile: (
    archivo: string,
    argumentos: readonly string[],
    opciones: { readonly shell: false; readonly windowsHide: true },
    alTerminar: (error: ErrorDeProceso) => void
  ) => unknown
  readonly spawn: (
    archivo: string,
    argumentos: readonly string[],
    opciones: {
      readonly cwd: string
      readonly shell: false
      readonly windowsHide: true
      readonly stdio: readonly ['pipe', number, number]
    }
  ) => HijoLanzado
}

export type ResultadoDeDocker = { readonly codigo: number | null; readonly noEncontrado: boolean }

export type OpcionesDelBackend = {
  readonly exe: string
  readonly carpeta: string
  readonly salida: number
}

export type ArgumentosDelBackend = readonly ['migrar'] | readonly ['--con-padre']

export type BackendLanzado = {
  readonly terminado: Promise<number | null>
  readonly detener: () => void
}

const procesosReales = procesosDelSistema as unknown as ModuloDeProcesos

export function ejecutarDocker(
  argumentos: readonly string[],
  procesos: ModuloDeProcesos = procesosReales
): Promise<ResultadoDeDocker> {
  return new Promise((resolver) => {
    procesos.execFile('docker', argumentos, { shell: false, windowsHide: true }, (error) => {
      if (error === null) {
        resolver({ codigo: 0, noEncontrado: false })
      } else if (error.code === 'ENOENT') {
        resolver({ codigo: null, noEncontrado: true })
      } else {
        resolver({ codigo: typeof error.code === 'number' ? error.code : null, noEncontrado: false })
      }
    })
  })
}

export function lanzarBackend(
  opciones: OpcionesDelBackend,
  argumentos: ArgumentosDelBackend,
  procesos: ModuloDeProcesos = procesosReales
): BackendLanzado {
  const hijo = procesos.spawn(opciones.exe, argumentos, {
    cwd: opciones.carpeta,
    shell: false,
    windowsHide: true,
    stdio: ['pipe', opciones.salida, opciones.salida]
  })
  const terminado = new Promise<number | null>((resolver) => {
    hijo.once('exit', (codigo) => resolver(typeof codigo === 'number' ? codigo : null))
    hijo.once('error', () => resolver(null))
  })
  return { terminado, detener: () => void hijo.kill() }
}
