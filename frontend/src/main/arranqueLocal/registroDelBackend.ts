import type { RutasDeArranque } from './rutas'
import type { LogAbierto } from './secuenciaDeArranque'

export type SistemaDeLog = {
  readonly crearCarpeta: (ruta: string) => void
  readonly existe: (ruta: string) => boolean
  readonly borrar: (ruta: string) => void
  readonly renombrar: (origen: string, destino: string) => void
  readonly abrirParaAgregar: (ruta: string) => number
  readonly cerrar: (descriptor: number) => void
}

export function abrirLog(rutas: RutasDeArranque, sistema: SistemaDeLog): LogAbierto {
  sistema.crearCarpeta(rutas.carpetaDeLogs)
  if (sistema.existe(rutas.log)) {
    if (sistema.existe(rutas.logAnterior)) {
      sistema.borrar(rutas.logAnterior)
    }
    sistema.renombrar(rutas.log, rutas.logAnterior)
  }
  const descriptor = sistema.abrirParaAgregar(rutas.log)
  return { descriptor, cerrar: () => sistema.cerrar(descriptor) }
}
