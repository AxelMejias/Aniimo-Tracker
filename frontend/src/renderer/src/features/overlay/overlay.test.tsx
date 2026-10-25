// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDePrueba
} from '../../../../../tests/fixtures/apiFalsa'
import { fichaDeReferencia } from '../../../../../tests/fixtures/ficha'
import OverlayApp from './OverlayApp'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const PRINCIPAL = teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })
const SECUNDARIO = teamDePrueba('Raid', 2, { 2: { ...RESUMEN_DE_IRISALIS, nombre: 'Orcus' } })
const FICHA = { ...fichaDeReferencia(), slot: 1, tieneImagen: false }

function conSeleccion(team = PRINCIPAL, extra: Parameters<typeof instalarApi>[0] = {}) {
  return instalarApi({
    ...extra,
    overlay: {
      obtenerSeleccion: async () => ({ ok: true, seleccion: { teamId: team.id } }),
      ...extra.overlay
    },
    teams: {
      listar: async () => ({ ok: true, teams: [PRINCIPAL, SECUNDARIO] }),
      obtenerFicha: async () => ({ ok: true, ficha: FICHA }),
      ...extra.teams
    }
  })
}

describe('team compacto', () => {
  it('muestra el nombre, la tarjeta de Irisalis y tres slots vacios', async () => {
    conSeleccion()
    render(<OverlayApp />)
    expect(await screen.findByRole('heading', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByText('Irisalis')).toBeInTheDocument()
    expect(screen.getByText('Nivel 60')).toBeInTheDocument()
    expect(screen.getByText('CP 3475')).toBeInTheDocument()
    expect(screen.getByText('Estrella 2')).toBeInTheDocument()
    expect(screen.getAllByText('Vacío')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /Agregar Aniimo/ })).toBeNull()
  })

  it('muestra el team elegido y no otro', async () => {
    conSeleccion(SECUNDARIO)
    render(<OverlayApp />)
    expect(await screen.findByRole('heading', { name: 'Raid' })).toBeInTheDocument()
    expect(screen.getByText('Orcus')).toBeInTheDocument()
    expect(screen.queryByText('Irisalis')).toBeNull()
  })
})

describe('ficha en solo lectura', () => {
  it('al tocar un slot pide ficha e imagen y permite volver', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText(/Ficha de solo lectura/)).toBeInTheDocument()
    expect(api.teams.obtenerFicha).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: 1 })
    expect(api.teams.obtenerImagen).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: 1 })
    expect(screen.queryByRole('button', { name: /guardar|borrar|vaciar/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Volver al team' }))
    expect(await screen.findByRole('heading', { name: 'Principal' })).toBeInTheDocument()
    expect(screen.getAllByText('Vacío')).toHaveLength(3)
  })

  it('no ofrece la sugerencia de stats ni pide el catalogo de calculo', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText(/Ficha de solo lectura/)).toBeInTheDocument()
    expect(screen.queryByText('Sugerencia de stats')).toBeNull()
    expect(api.calculo.obtenerCatalogo).not.toHaveBeenCalled()
  })

  it('muestra las notas propias aunque esten marcadas privadas', async () => {
    conSeleccion(PRINCIPAL, {
      teams: {
        obtenerFicha: async () => ({
          ok: true,
          ficha: { ...FICHA, notas: 'Nota solo mia', notasPrivadas: true }
        })
      }
    })
    render(<OverlayApp />)
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText('Nota solo mia')).toBeInTheDocument()
  })

  it('una ficha no encontrada muestra que el team ya no existe', async () => {
    conSeleccion(PRINCIPAL, {
      teams: { obtenerFicha: async () => ({ ok: false, error: 'no-encontrado' }) }
    })
    render(<OverlayApp />)
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText('Ese team ya no existe')).toBeInTheDocument()
  })

  it('sesion vencida al leer la ficha cierra el overlay sin mostrar datos', async () => {
    const api = conSeleccion(PRINCIPAL, {
      teams: { obtenerFicha: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    render(<OverlayApp />)
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    await waitFor(() => expect(api.overlay.cerrar).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/Ficha de solo lectura/)).toBeNull()
  })
})

describe('estados sin team', () => {
  it('sin seleccion explica como elegir y no llama a teams', async () => {
    const api = instalarApi()
    render(<OverlayApp />)
    expect(
      await screen.findByText('Elegí un team desde «Mis teams» con «Abrir en overlay»')
    ).toBeInTheDocument()
    expect(api.teams.listar).not.toHaveBeenCalled()
  })

  it('un team ausente del listado muestra que ya no existe', async () => {
    instalarApi({
      overlay: {
        obtenerSeleccion: async () => ({ ok: true, seleccion: { teamId: SECUNDARIO.id } })
      },
      teams: { listar: async () => ({ ok: true, teams: [PRINCIPAL] }) }
    })
    render(<OverlayApp />)
    expect(await screen.findByText('Ese team ya no existe')).toBeInTheDocument()
    expect(screen.queryByText('Irisalis')).toBeNull()
  })

  it('sesion vencida al listar cierra el overlay y no muestra datos', async () => {
    const api = conSeleccion(PRINCIPAL, {
      teams: { listar: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    render(<OverlayApp />)
    await waitFor(() => expect(api.overlay.cerrar).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Irisalis')).toBeNull()
  })

  it('otro error muestra el aviso y conserva lo ultimo mostrado', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    await screen.findByText('Irisalis')
    api.teams.listar.mockResolvedValueOnce({ ok: false, error: 'sin-conexion' })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText('No se pudieron cargar los datos')).toBeInTheDocument()
    expect(screen.getByText('Irisalis')).toBeInTheDocument()
  })
})

describe('acciones y estructura', () => {
  it('Cerrar overlay llama a overlay.cerrar', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    await screen.findByText('Irisalis')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar overlay' }))
    expect(api.overlay.cerrar).toHaveBeenCalledTimes(1)
  })

  it('no usa estilos inline ni controles de edicion en el team ni en la ficha', async () => {
    conSeleccion()
    const { container } = render(<OverlayApp />)
    await screen.findByText('Irisalis')
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Irisalis/ }))
    await screen.findByText(/Ficha de solo lectura/)
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
    expect(container.querySelectorAll('input, select, textarea')).toHaveLength(0)
  })

  it('tiene la barra de arrastre con las acciones', async () => {
    conSeleccion()
    render(<OverlayApp />)
    const barra = await screen.findByRole('banner')
    expect(within(barra).getByRole('button', { name: 'Actualizar' })).toBeInTheDocument()
    expect(within(barra).getByRole('button', { name: 'Cerrar overlay' })).toBeInTheDocument()
  })
})

describe('refresco sin polling', () => {
  it('al enfocar la ventana vuelve a pedir seleccion y teams', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    await screen.findByText('Irisalis')
    expect(api.teams.listar).toHaveBeenCalledTimes(1)
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(api.teams.listar).toHaveBeenCalledTimes(2))
    expect(api.overlay.obtenerSeleccion).toHaveBeenCalledTimes(2)
  })

  it('al enfocar muestra el team nuevo si la seleccion cambio', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    await screen.findByRole('heading', { name: 'Principal' })
    api.overlay.obtenerSeleccion.mockResolvedValue({
      ok: true,
      seleccion: { teamId: SECUNDARIO.id }
    })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(await screen.findByRole('heading', { name: 'Raid' })).toBeInTheDocument()
    expect(screen.getByText('Orcus')).toBeInTheDocument()
  })

  it('Actualizar recarga los teams y la ficha abierta', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    await screen.findByText(/Ficha de solo lectura/)
    expect(api.teams.obtenerFicha).toHaveBeenCalledTimes(1)
    api.teams.obtenerFicha.mockResolvedValue({
      ok: true,
      ficha: { ...FICHA, notas: 'Cambio nuevo', notasPrivadas: false }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText('Cambio nuevo')).toBeInTheDocument()
    expect(api.teams.listar).toHaveBeenCalledTimes(2)
    expect(api.teams.obtenerFicha).toHaveBeenCalledTimes(2)
  })

  it('foco y Actualizar simultaneos hacen una sola lectura de teams', async () => {
    const api = conSeleccion()
    render(<OverlayApp />)
    await screen.findByText('Irisalis')
    api.teams.listar.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    })
    await waitFor(() => expect(api.teams.listar).toHaveBeenCalledTimes(1))
  })

  it('quita el listener de foco al desmontar', async () => {
    const api = conSeleccion()
    const { unmount } = render(<OverlayApp />)
    await screen.findByText('Irisalis')
    unmount()
    api.teams.listar.mockClear()
    window.dispatchEvent(new Event('focus'))
    expect(api.teams.listar).not.toHaveBeenCalled()
  })

  it('no programa timers propios ni vuelve a llamar a la API con el reloj', async () => {
    vi.useFakeTimers()
    const setIntervalEspia = vi.spyOn(globalThis, 'setInterval')
    const api = conSeleccion()
    render(<OverlayApp />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText('Irisalis')).toBeInTheDocument()
    const llamadas = api.teams.listar.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    })
    expect(api.teams.listar.mock.calls.length).toBe(llamadas)
    expect(setIntervalEspia).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
