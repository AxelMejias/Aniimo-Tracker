import { describe, expect, it, vi } from 'vitest'
import { estaCorriendo, type ModuloDeLista } from './listaDeProcesos'

type Llamada = {
  readonly archivo: string
  readonly argumentos: readonly string[]
  readonly opciones: Record<string, unknown>
}

function moduloFalso(respuesta: { error?: Error | null; salida?: string }) {
  const llamadas: Llamada[] = []
  const modulo: ModuloDeLista = {
    execFile: vi.fn((archivo, argumentos, opciones, alTerminar) => {
      llamadas.push({ archivo, argumentos, opciones })
      alTerminar(respuesta.error ?? null, respuesta.salida ?? '')
    })
  }
  return { modulo, llamadas }
}

const FILA_DEL_JUEGO = '"Aniimo.exe","12345","Console","1","812,344 K"\r\n'
const SIN_TAREAS_EN = 'INFO: No tasks are running which match the specified criteria.\r\n'
const SIN_TAREAS_ES = 'INFORMACIÓN: no hay tareas ejecutándose que coincidan con los criterios especificados.\r\n'

describe('estaCorriendo', () => {
  it('llama a tasklist.exe con ruta absoluta y argumentos fijos', async () => {
    const { modulo, llamadas } = moduloFalso({ salida: FILA_DEL_JUEGO })

    await estaCorriendo('Aniimo.exe', modulo, 'C:\\Windows')

    expect(llamadas).toHaveLength(1)
    expect(llamadas[0]?.archivo).toBe('C:\\Windows\\System32\\tasklist.exe')
    expect(llamadas[0]?.argumentos).toEqual(['/FI', 'IMAGENAME eq Aniimo.exe', '/FO', 'CSV', '/NH'])
    expect(llamadas[0]?.opciones).toMatchObject({ shell: false, windowsHide: true })
    expect(llamadas[0]?.opciones['timeout']).toEqual(expect.any(Number))
    expect(llamadas[0]?.opciones['maxBuffer']).toEqual(expect.any(Number))
  })

  it('devuelve true con una fila del juego', async () => {
    const { modulo } = moduloFalso({ salida: FILA_DEL_JUEGO })
    expect(await estaCorriendo('Aniimo.exe', modulo, 'C:\\Windows')).toBe(true)
  })

  it('no distingue mayusculas', async () => {
    const { modulo } = moduloFalso({ salida: '"aniimo.EXE","1","Console","1","1 K"\r\n' })
    expect(await estaCorriendo('Aniimo.exe', modulo, 'C:\\Windows')).toBe(true)
  })

  it('encuentra la fila entre varias', async () => {
    const { modulo } = moduloFalso({ salida: `"otro.exe","2","Console","1","1 K"\r\n${FILA_DEL_JUEGO}` })
    expect(await estaCorriendo('Aniimo.exe', modulo, 'C:\\Windows')).toBe(true)
  })

  it.each([
    ['mensaje en ingles', SIN_TAREAS_EN],
    ['mensaje en castellano', SIN_TAREAS_ES],
    ['salida vacia', ''],
    ['otro proceso con nombre parecido', '"AniimoHelper.exe","9","Console","1","1 K"\r\n']
  ])('devuelve false con %s', async (_motivo, salida) => {
    const { modulo } = moduloFalso({ salida })
    expect(await estaCorriendo('Aniimo.exe', modulo, 'C:\\Windows')).toBe(false)
  })

  it('devuelve false sin lanzar si hay error o tope de tiempo', async () => {
    const { modulo } = moduloFalso({ error: new Error('ETIMEDOUT'), salida: FILA_DEL_JUEGO })
    expect(await estaCorriendo('Aniimo.exe', modulo, 'C:\\Windows')).toBe(false)
  })

  it('no ejecuta nada con un nombre invalido', async () => {
    const { modulo, llamadas } = moduloFalso({ salida: FILA_DEL_JUEGO })
    expect(await estaCorriendo('Aniimo.exe" /M', modulo, 'C:\\Windows')).toBe(false)
    expect(llamadas).toHaveLength(0)
  })

  it('no escribe la salida en la consola', async () => {
    const espiaLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const espiaError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { modulo } = moduloFalso({ salida: FILA_DEL_JUEGO })
    await estaCorriendo('Aniimo.exe', modulo, 'C:\\Windows')
    expect(espiaLog).not.toHaveBeenCalled()
    expect(espiaError).not.toHaveBeenCalled()
    espiaLog.mockRestore()
    espiaError.mockRestore()
  })
})
