import { describe, expect, it } from 'vitest'
import { abrirLog, type SistemaDeLog } from './registroDelBackend'
import { rutasDeArranque } from './rutas'

const rutas = rutasDeArranque(String.raw`C:\Datos`, String.raw`C:\Programa\resources`)

function sistemaFalso(existentes: string[] = []) {
  const archivos = new Set(existentes)
  const llamadas: string[] = []
  const sistema: SistemaDeLog = {
    crearCarpeta: (ruta) => {
      llamadas.push(`carpeta ${ruta}`)
    },
    existe: (ruta) => archivos.has(ruta),
    borrar: (ruta) => {
      llamadas.push(`borrar ${ruta}`)
      archivos.delete(ruta)
    },
    renombrar: (origen, destino) => {
      llamadas.push(`renombrar ${origen} ${destino}`)
      archivos.delete(origen)
      archivos.add(destino)
    },
    abrirParaAgregar: (ruta) => {
      llamadas.push(`abrir ${ruta}`)
      return 42
    },
    cerrar: (descriptor) => {
      llamadas.push(`cerrar ${descriptor}`)
    }
  }
  return { sistema, llamadas }
}

describe('abrirLog', () => {
  it('sin log previo crea la carpeta y abre backend.log', () => {
    const { sistema, llamadas } = sistemaFalso()
    const log = abrirLog(rutas, sistema)
    expect(log.descriptor).toBe(42)
    expect(llamadas).toEqual([`carpeta ${rutas.carpetaDeLogs}`, `abrir ${rutas.log}`])
  })

  it('el log anterior pasa a backend.anterior.log', () => {
    const { sistema, llamadas } = sistemaFalso([rutas.log])
    abrirLog(rutas, sistema)
    expect(llamadas).toEqual([
      `carpeta ${rutas.carpetaDeLogs}`,
      `renombrar ${rutas.log} ${rutas.logAnterior}`,
      `abrir ${rutas.log}`
    ])
  })

  it('si ya habia un anterior lo reemplaza', () => {
    const { sistema, llamadas } = sistemaFalso([rutas.log, rutas.logAnterior])
    abrirLog(rutas, sistema)
    expect(llamadas).toContain(`borrar ${rutas.logAnterior}`)
    expect(llamadas.indexOf(`borrar ${rutas.logAnterior}`)).toBeLessThan(
      llamadas.indexOf(`renombrar ${rutas.log} ${rutas.logAnterior}`)
    )
  })

  it('cerrar cierra el descriptor', () => {
    const { sistema, llamadas } = sistemaFalso()
    abrirLog(rutas, sistema).cerrar()
    expect(llamadas.at(-1)).toBe('cerrar 42')
  })
})
