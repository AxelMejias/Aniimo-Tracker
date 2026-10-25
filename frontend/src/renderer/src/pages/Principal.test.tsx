// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BRUNO,
  instalarApi,
  RESUMEN_DE_IRISALIS,
  SOLICITUD_DE_CARLA,
  teamDePrueba
} from '../../../../tests/fixtures/apiFalsa'
import type { ResultadoListarAmigos } from '../../../shared/amigos'
import App from '../App'

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

const SIN_AMIGOS: ResultadoListarAmigos = { ok: true, amigos: [], recibidas: [], enviadas: [] }
const CON_SOLICITUD: ResultadoListarAmigos = {
  ok: true,
  amigos: [],
  recibidas: [SOLICITUD_DE_CARLA],
  enviadas: []
}

function navegacion(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Secciones' })
}

function irA(seccion: string): void {
  fireEvent.click(within(navegacion()).getByRole('button', { name: seccion }))
}

async function verMisTeams(): Promise<void> {
  await screen.findByRole('heading', { name: 'Mis teams' })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
}

describe('encabezado compartido y navegacion', () => {
  it('muestra el usuario, cerrar sesion y las tres secciones con Mis teams activa', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.getByRole('heading', { name: 'Aniimo Team Tracker' })).toBeInTheDocument()
    expect(screen.getByText('axel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    const botones = within(navegacion()).getAllByRole('button')
    expect(botones.map((b) => b.textContent)).toEqual(['Mis teams', 'Amigos', 'Comparar'])
    expect(within(navegacion()).getByRole('button', { name: 'Mis teams' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(within(navegacion()).getByRole('button', { name: 'Amigos' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('cada seccion muestra su titulo y marca su boton como activo', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    for (const seccion of ['Amigos', 'Comparar', 'Mis teams']) {
      irA(seccion)
      expect(await screen.findByRole('heading', { level: 2, name: seccion })).toBeInTheDocument()
      expect(within(navegacion()).getByRole('button', { name: seccion })).toHaveAttribute(
        'aria-current',
        'page'
      )
    }
  })

  it('al volver a Mis teams se recargan los teams', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: true, teams: [teamDePrueba('Principal')] }) }
    })
    render(<App />)
    await verMisTeams()
    expect(api.teams.listar).toHaveBeenCalledTimes(1)
    irA('Amigos')
    await screen.findByRole('heading', { level: 2, name: 'Amigos' })
    irA('Mis teams')
    await verMisTeams()
    expect(api.teams.listar).toHaveBeenCalledTimes(2)
  })

  it('no usa atributos style', async () => {
    instalarApi({ amigos: { listar: async () => CON_SOLICITUD } })
    const { container } = render(<App />)
    await verMisTeams()
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('estado de amigos centralizado', () => {
  it('abrir y cerrar una ficha propia dispara un refresco cada vez', async () => {
    const api = instalarApi({
      teams: {
        listar: async () => ({
          ok: true,
          teams: [teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })]
        })
      }
    })
    render(<App />)
    await verMisTeams()
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalled())
    api.amigos.listar.mockClear()
    fireEvent.click(screen.getAllByRole('button', { name: 'Agregar Aniimo' })[0] as HTMLElement)
    await screen.findByRole('heading', { name: /Ficha del Aniimo/ })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await verMisTeams()
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(2))
  })

  it('el contador pasa a Solicitudes (1) tras una navegacion, sin abrir Amigos', async () => {
    const api = instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.queryByText(/Solicitudes \(/)).toBeNull()
    api.amigos.listar.mockResolvedValue(CON_SOLICITUD)
    irA('Comparar')
    expect(await screen.findByText('Solicitudes (1)')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Amigos' })).toBeNull()
  })

  it('sin solicitudes recibidas no hay contador', async () => {
    instalarApi({ amigos: { listar: async () => ({ ...SIN_AMIGOS, amigos: [BRUNO] }) } })
    render(<App />)
    await verMisTeams()
    await waitFor(() => expect(screen.queryByText(/Solicitudes \(/)).toBeNull())
  })

  it('disparos simultaneos comparten una sola llamada y ven el mismo resultado', async () => {
    const api = instalarApi()
    render(<App />)
    await verMisTeams()
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalled())
    api.amigos.listar.mockClear()
    let resolver: (resultado: ResultadoListarAmigos) => void = () => undefined
    api.amigos.listar.mockImplementationOnce(
      () => new Promise<ResultadoListarAmigos>((resolve) => (resolver = resolve))
    )
    irA('Amigos')
    await screen.findByRole('heading', { level: 2, name: 'Amigos' })
    expect(api.amigos.listar).toHaveBeenCalledTimes(1)
    await act(async () => resolver(CON_SOLICITUD))
    expect(await screen.findByText('Solicitudes (1)')).toBeInTheDocument()
    expect(api.amigos.listar).toHaveBeenCalledTimes(1)
  })

  it('la carga inicial hace una sola llamada aunque la pidan el encabezado y Mis teams', async () => {
    const api = instalarApi()
    render(<App />)
    await verMisTeams()
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(1))
  })

  it('sin timers: no queda ninguno pendiente y avanzar el reloj no refresca', async () => {
    vi.useFakeTimers()
    const api = instalarApi()
    await act(async () => {
      render(<App />)
    })
    for (const seccion of ['Amigos', 'Comparar', 'Mis teams']) {
      await act(async () => {
        irA(seccion)
      })
    }
    expect(screen.getByRole('heading', { level: 2, name: 'Mis teams' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
    const llamadas = api.amigos.listar.mock.calls.length
    expect(llamadas).toBeGreaterThan(0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_600_000)
    })
    expect(api.amigos.listar).toHaveBeenCalledTimes(llamadas)
  })

  it('sesion vencida en el refresco vuelve al login con el aviso', async () => {
    instalarApi({ amigos: { listar: async () => ({ ok: false, error: 'sesion-vencida' }) } })
    render(<App />)
    expect(await screen.findByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })

  it('otro error en el refresco conserva el ultimo estado sin alerta', async () => {
    const api = instalarApi({ amigos: { listar: async () => CON_SOLICITUD } })
    render(<App />)
    await verMisTeams()
    expect(await screen.findByText('Solicitudes (1)')).toBeInTheDocument()
    api.amigos.listar.mockResolvedValue({ ok: false, error: 'sin-conexion' })
    irA('Comparar')
    await screen.findByRole('heading', { level: 2, name: 'Comparar' })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Solicitudes (1)')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('cambio de cuenta', () => {
  it('no deja restos del usuario anterior y el contador es el de la cuenta nueva', async () => {
    const equipoDeAxel = teamDePrueba('Equipo de Axel', 1, { 1: RESUMEN_DE_IRISALIS })
    const equipoDeCarla = teamDePrueba('Equipo de Carla', 1)
    let cuenta = 'axel'
    const api = instalarApi({
      auth: {
        iniciarSesion: async () => {
          cuenta = 'carla'
          return { ok: true, nombreUsuario: 'carla' }
        },
        cerrarSesion: async () => ({ ok: true, nombreUsuario: null })
      },
      teams: {
        listar: async () => ({
          ok: true,
          teams: cuenta === 'axel' ? [equipoDeAxel] : [equipoDeCarla]
        })
      },
      amigos: {
        listar: async () =>
          cuenta === 'axel'
            ? { ok: true, amigos: [BRUNO], recibidas: [SOLICITUD_DE_CARLA, SOLICITUD_DE_CARLA], enviadas: [] }
            : { ok: true, amigos: [], recibidas: [SOLICITUD_DE_CARLA], enviadas: [] }
      }
    })
    render(<App />)
    await verMisTeams()
    expect(await screen.findByText('Equipo de Axel')).toBeInTheDocument()
    expect(await screen.findByText('Solicitudes (2)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.queryByText('Equipo de Axel')).toBeNull()

    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'carla' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'una-clave-larga' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('Equipo de Carla')).toBeInTheDocument()
    expect(await screen.findByText('Solicitudes (1)')).toBeInTheDocument()
    expect(screen.getByText('carla')).toBeInTheDocument()
    expect(screen.queryByText('Equipo de Axel')).toBeNull()
    expect(screen.queryByText('Irisalis')).toBeNull()
    expect(screen.queryByText('Solicitudes (2)')).toBeNull()
    expect(api.auth.cerrarSesion).toHaveBeenCalledTimes(1)
  })
})
