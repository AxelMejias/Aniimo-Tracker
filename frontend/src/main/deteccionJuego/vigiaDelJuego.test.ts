import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearVigia } from './vigiaDelJuego'

function preparar(respuestas: boolean[]) {
  const pendientes = [...respuestas]
  const consultar = vi.fn(async () => pendientes.shift() ?? false)
  const alAbrirse = vi.fn()
  const alCerrarse = vi.fn()
  const vigia = crearVigia({ consultar, alAbrirse, alCerrarse })
  return { vigia, consultar, alAbrirse, alCerrarse }
}

async function pasar(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('crearVigia', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('apagado no consulta nunca ni deja timers', async () => {
    const { consultar } = preparar([true])
    await pasar(60_000)
    expect(consultar).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('encendido consulta al encender y luego cada 5 segundos', async () => {
    const { vigia, consultar } = preparar([false, false, false, false])
    vigia.encender()
    await pasar(0)
    expect(consultar).toHaveBeenCalledTimes(1)
    await pasar(4999)
    expect(consultar).toHaveBeenCalledTimes(1)
    await pasar(1)
    expect(consultar).toHaveBeenCalledTimes(2)
    await pasar(10_000)
    expect(consultar).toHaveBeenCalledTimes(4)
    vigia.apagar()
  })

  it('encender dos veces no duplica el timer', async () => {
    const { vigia, consultar } = preparar([])
    vigia.encender()
    vigia.encender()
    await pasar(5000)
    expect(consultar).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(1)
    vigia.apagar()
  })

  it('avisa juego-abierto solo en la primera deteccion', async () => {
    const { vigia, alAbrirse } = preparar([false, true, true, true])
    vigia.encender()
    await pasar(0)
    expect(alAbrirse).not.toHaveBeenCalled()
    await pasar(5000)
    expect(alAbrirse).toHaveBeenCalledTimes(1)
    await pasar(10_000)
    expect(alAbrirse).toHaveBeenCalledTimes(1)
    vigia.apagar()
  })

  it('avisa juego-abierto si el juego ya estaba abierto al encender', async () => {
    const { vigia, alAbrirse } = preparar([true])
    vigia.encender()
    await pasar(0)
    expect(alAbrirse).toHaveBeenCalledTimes(1)
    vigia.apagar()
  })

  it('juego-cerrado solo tras dos faltas seguidas', async () => {
    const { vigia, alCerrarse } = preparar([true, false, true, false, false])
    vigia.encender()
    await pasar(0)
    await pasar(5000)
    await pasar(5000)
    await pasar(5000)
    expect(alCerrarse).not.toHaveBeenCalled()
    await pasar(5000)
    expect(alCerrarse).toHaveBeenCalledTimes(1)
    vigia.apagar()
  })

  it('despues de cerrarse una nueva apertura vuelve a avisar', async () => {
    const { vigia, alAbrirse, alCerrarse } = preparar([true, false, false, true])
    vigia.encender()
    await pasar(0)
    await pasar(10_000)
    expect(alAbrirse).toHaveBeenCalledTimes(1)
    expect(alCerrarse).toHaveBeenCalledTimes(1)
    await pasar(5000)
    expect(alAbrirse).toHaveBeenCalledTimes(2)
    vigia.apagar()
  })

  it('con una sola falta la reaparicion no vuelve a avisar', async () => {
    const { vigia, alAbrirse } = preparar([true, false, true])
    vigia.encender()
    await pasar(0)
    await pasar(10_000)
    expect(alAbrirse).toHaveBeenCalledTimes(1)
    vigia.apagar()
  })

  it('nunca hay dos consultas en vuelo', async () => {
    let enVuelo = 0
    let maximo = 0
    let terminar: () => void = () => undefined
    const consultar = vi.fn(
      () =>
        new Promise<boolean>((resolver) => {
          enVuelo += 1
          maximo = Math.max(maximo, enVuelo)
          terminar = () => {
            enVuelo -= 1
            resolver(false)
          }
        })
    )
    const vigia = crearVigia({ consultar, alAbrirse: vi.fn(), alCerrarse: vi.fn() })
    vigia.encender()
    await pasar(20_000)
    expect(consultar).toHaveBeenCalledTimes(1)
    terminar()
    await pasar(5000)
    expect(consultar).toHaveBeenCalledTimes(2)
    expect(maximo).toBe(1)
    vigia.apagar()
  })

  it('apagar cancela el timer y descarta la consulta en vuelo', async () => {
    let resolverConsulta: (valor: boolean) => void = () => undefined
    const alAbrirse = vi.fn()
    const vigia = crearVigia({
      consultar: () => new Promise<boolean>((resolver) => (resolverConsulta = resolver)),
      alAbrirse,
      alCerrarse: vi.fn()
    })
    vigia.encender()
    await pasar(0)
    vigia.apagar()
    expect(vi.getTimerCount()).toBe(0)
    resolverConsulta(true)
    await pasar(0)
    expect(alAbrirse).not.toHaveBeenCalled()
  })

  it('el aviso de cierre es opcional', async () => {
    const respuestas = [true, false, false]
    const vigia = crearVigia({
      consultar: async () => respuestas.shift() ?? false,
      alAbrirse: vi.fn()
    })
    vigia.encender()
    await pasar(10_000)
    expect(vi.getTimerCount()).toBe(1)
    vigia.apagar()
  })

  it('encender despues de apagar empieza de cero', async () => {
    const { vigia, alAbrirse } = preparar([true, true])
    vigia.encender()
    await pasar(0)
    vigia.apagar()
    vigia.encender()
    await pasar(0)
    expect(alAbrirse).toHaveBeenCalledTimes(2)
    vigia.apagar()
  })
})
