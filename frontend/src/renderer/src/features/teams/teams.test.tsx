// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  armarGrupo,
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDePrueba
} from '../../../../../tests/fixtures/apiFalsa'
import App from '../../App'

afterEach(cleanup)

const VEINTE_TEAMS = Array.from({ length: 20 }, (_, i) => teamDePrueba(`Team ${i + 1}`, i + 1))

async function verMisTeams(): Promise<void> {
  await screen.findByRole('heading', { name: 'Mis teams' })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
}

function pila(nombre: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^Team ${nombre}, `) })
}

function seccionDeSueltos(): HTMLElement {
  return screen.getByRole('region', { name: 'Teams sueltos' })
}

describe('pantalla Mis teams como mazo', () => {
  it('muestra el usuario, cerrar sesion y el titulo de la app', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.getByRole('heading', { name: 'Aniimo Team Tracker' })).toBeInTheDocument()
    expect(screen.getByText('Sesión: axel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('un team suelto es una pila con la carta de Irisalis arriba y 1/4', async () => {
    instalarApi({
      teams: {
        listar: async () => ({
          ok: true,
          grupos: [],
          teams: [teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })]
        })
      }
    })
    render(<App />)
    await verMisTeams()
    const sueltos = within(seccionDeSueltos())
    const principal = within(sueltos.getByRole('button', { name: 'Team Principal, 1 de 4 Aniimo' }))
    expect(principal.getByText('Irisalis')).toBeInTheDocument()
    expect(principal.getByText('Nv 60')).toBeInTheDocument()
    expect(principal.getByText('CP 3475')).toBeInTheDocument()
    expect(principal.getByText('1/4')).toBeInTheDocument()
  })

  it('sin teams ofrece Nuevo team y ninguna pila', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.getByRole('button', { name: 'Nuevo team' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Team / })).toBeNull()
  })

  it('con cuatro teams propone Team 5', async () => {
    const cuatro = [1, 2, 3, 4].map((n) => teamDePrueba(`T${n}`, n))
    instalarApi({ teams: { listar: async () => ({ ok: true, grupos: [], teams: cuatro }) } })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    expect((screen.getByLabelText('Nombre del team') as HTMLInputElement).value).toBe('Team 5')
  })

  it('con veinte teams no ofrece Nuevo team y muestra las veinte pilas', async () => {
    instalarApi({ teams: { listar: async () => ({ ok: true, grupos: [], teams: VEINTE_TEAMS }) } })
    render(<App />)
    await verMisTeams()
    expect(within(seccionDeSueltos()).getAllByRole('button', { name: /^Team / })).toHaveLength(20)
    expect(screen.queryByRole('button', { name: 'Nuevo team' })).toBeNull()
  })

  it('un team sin Aniimo muestra 0/4 y el texto de team vacio', async () => {
    instalarApi({
      teams: { listar: async () => ({ ok: true, grupos: [], teams: [teamDePrueba('Farmeo', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    const farmeo = within(pila('Farmeo'))
    expect(farmeo.getByText('0/4')).toBeInTheDocument()
    expect(farmeo.getByText('Team vacío. Agregá tu primer Aniimo.')).toBeInTheDocument()
  })

  it('un team oculto muestra la marca una sola vez y uno visible no la muestra', async () => {
    instalarApi({
      teams: {
        listar: async () => ({
          ok: true,
          grupos: [],
          teams: [teamDePrueba('Jefes', 1, {}, true), teamDePrueba('Raid', 2)]
        })
      }
    })
    render(<App />)
    await verMisTeams()
    expect(screen.getAllByText('Oculto para amigos')).toHaveLength(1)
    expect(within(pila('Jefes')).getByText('Oculto para amigos')).toBeInTheDocument()
    expect(within(pila('Raid')).queryByText('Oculto para amigos')).toBeNull()
  })

  it('muestra el error de carga y permite reintentar', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    render(<App />)
    expect(
      await screen.findByText(
        'No se pudo conectar con el servidor. Revisá que el backend esté levantado.'
      )
    ).toBeInTheDocument()
    api.teams.listar.mockResolvedValueOnce({ ok: true, grupos: [], teams: [teamDePrueba('Recargado')] })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: /^Team Recargado, / })).toBeInTheDocument()
  })

  it('no usa atributos style, cerrado ni con un grupo desplegado', async () => {
    const buildeado = armarGrupo('Buildeado', 1, [
      teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS }),
      teamDePrueba('Raid', 2)
    ])
    instalarApi({
      teams: {
        listar: async () => ({
          ok: true,
          grupos: [buildeado.grupo],
          teams: [...buildeado.teams, teamDePrueba('Farmeo', 3)]
        })
      }
    })
    const { container } = render(<App />)
    await verMisTeams()
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /^Buildeado / }))
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('crear team', () => {
  it('propone Team N, envia el nombre elegido y recarga la lista', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: true, grupos: [], teams: [teamDePrueba('Principal', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    const campo = screen.getByLabelText('Nombre del team') as HTMLInputElement
    expect(campo.value).toBe('Team 2')
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      grupos: [],
      teams: [teamDePrueba('Principal', 1), teamDePrueba('Raid', 2)]
    })
    fireEvent.change(campo, { target: { value: 'Raid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(
      await within(seccionDeSueltos()).findByRole('button', { name: /^Team Raid, / })
    ).toBeInTheDocument()
    expect(api.teams.crear).toHaveBeenCalledWith({ nombre: 'Raid' })
    expect(api.teams.listar).toHaveBeenCalledTimes(2)
  })

  it('propone Team 1 cuando no hay teams', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    expect((screen.getByLabelText('Nombre del team') as HTMLInputElement).value).toBe('Team 1')
  })

  it('con el maximo de teams alcanzado muestra el mensaje del limite', async () => {
    instalarApi({
      teams: {
        listar: async () => ({ ok: true, grupos: [], teams: [teamDePrueba('Principal', 1)] }),
        crear: async () => ({ ok: false, error: 'limite-de-teams' })
      }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByText('Ya tenés el máximo de 20 teams')).toBeInTheDocument()
  })

  it('cancelar cierra el formulario sin llamar a la API', async () => {
    const api = instalarApi()
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nombre del team')).toBeNull()
    expect(api.teams.crear).not.toHaveBeenCalled()
  })
})

describe('abrir un team y sesion', () => {
  it('activar la pila con clic abre la pantalla del team con el foco en su titulo', async () => {
    instalarApi({
      teams: { listar: async () => ({ ok: true, grupos: [], teams: [teamDePrueba('Farmeo', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(pila('Farmeo'))
    const titulo = await screen.findByRole('heading', { level: 2, name: 'Farmeo' })
    expect(document.activeElement).toBe(titulo)
    expect(screen.queryByRole('heading', { name: 'Mis teams' })).toBeNull()
  })

  it('sesion-vencida al listar vuelve al login con el aviso', async () => {
    instalarApi({ teams: { listar: async () => ({ ok: false, error: 'sesion-vencida' }) } })
    render(<App />)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it('sesion-vencida al crear vuelve al login con el aviso', async () => {
    instalarApi({ teams: { crear: async () => ({ ok: false, error: 'sesion-vencida' }) } })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it('cerrar sesion vuelve al login', async () => {
    const api = instalarApi()
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(api.auth.cerrarSesion).toHaveBeenCalled()
  })
})
