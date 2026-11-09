import { describe, expect, it, vi } from 'vitest'
import { crearServicioDePreferencias } from './servicioDePreferencias'

function preparar(opciones: { guardada?: boolean; disponible?: boolean; inicio?: boolean } = {}) {
  const vigia = { encender: vi.fn(), apagar: vi.fn() }
  const inicioDeWindows = { activo: opciones.inicio ?? false, poner: vi.fn() }
  const guardar = vi.fn(async () => undefined)
  const servicio = crearServicioDePreferencias({
    leerGuardadas: async () => ({ abrirAppConElJuego: opciones.guardada ?? false }),
    guardar,
    vigia,
    segundoPlano: {
      disponible: opciones.disponible ?? true,
      leerInicio: () => inicioDeWindows.activo,
      ponerInicio: inicioDeWindows.poner
    }
  })
  return { servicio, vigia, inicioDeWindows, guardar }
}

describe('iniciar', () => {
  it('con la opcion apagada no enciende el vigia', async () => {
    const { servicio, vigia } = preparar({ guardada: false })
    await servicio.iniciar()
    expect(vigia.encender).not.toHaveBeenCalled()
  })

  it('con la opcion guardada encendida enciende el vigia', async () => {
    const { servicio, vigia } = preparar({ guardada: true })
    await servicio.iniciar()
    expect(vigia.encender).toHaveBeenCalledTimes(1)
  })
})

describe('obtener', () => {
  it('refleja la opcion guardada y el inicio de Windows', async () => {
    const { servicio } = preparar({ guardada: true, inicio: true })
    await servicio.iniciar()
    expect(await servicio.obtener()).toEqual({
      abrirAppConElJuego: true,
      arrancarConWindows: true,
      segundoPlanoDisponible: true
    })
  })

  it('en desarrollo arrancarConWindows es falso aunque Windows diga otra cosa', async () => {
    const { servicio } = preparar({ disponible: false, inicio: true })
    await servicio.iniciar()
    expect(await servicio.obtener()).toEqual({
      abrirAppConElJuego: false,
      arrancarConWindows: false,
      segundoPlanoDisponible: false
    })
  })
})

describe('cambiar abrirAppConElJuego', () => {
  it('encender guarda y enciende el vigia', async () => {
    const { servicio, vigia, guardar } = preparar()
    await servicio.iniciar()
    const resultado = await servicio.cambiar('abrirAppConElJuego', true)
    expect(vigia.encender).toHaveBeenCalledTimes(1)
    expect(guardar).toHaveBeenCalledWith({ abrirAppConElJuego: true })
    expect(resultado.abrirAppConElJuego).toBe(true)
  })

  it('apagar guarda y apaga el vigia', async () => {
    const { servicio, vigia, guardar } = preparar({ guardada: true })
    await servicio.iniciar()
    const resultado = await servicio.cambiar('abrirAppConElJuego', false)
    expect(vigia.apagar).toHaveBeenCalledTimes(1)
    expect(guardar).toHaveBeenCalledWith({ abrirAppConElJuego: false })
    expect(resultado.abrirAppConElJuego).toBe(false)
  })
})

describe('cambiar arrancarConWindows', () => {
  it('empaquetada llama a ponerInicio con el valor', async () => {
    const { servicio, inicioDeWindows, guardar, vigia } = preparar({ disponible: true })
    await servicio.iniciar()
    await servicio.cambiar('arrancarConWindows', true)
    expect(inicioDeWindows.poner).toHaveBeenCalledWith(true)
    await servicio.cambiar('arrancarConWindows', false)
    expect(inicioDeWindows.poner).toHaveBeenLastCalledWith(false)
    expect(guardar).not.toHaveBeenCalled()
    expect(vigia.encender).not.toHaveBeenCalled()
  })

  it('en desarrollo no llama nunca a ponerInicio', async () => {
    const { servicio, inicioDeWindows } = preparar({ disponible: false })
    await servicio.iniciar()
    await servicio.cambiar('arrancarConWindows', true)
    expect(inicioDeWindows.poner).not.toHaveBeenCalled()
  })
})
