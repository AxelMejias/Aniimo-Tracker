// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDePrueba
} from '../../../../../tests/fixtures/apiFalsa'
import App from '../../App'

afterEach(cleanup)

const CUATRO_TEAMS = [1, 2, 3, 4].map((orden) => teamDePrueba(`Team ${orden}`, orden))

async function verMisTeams(): Promise<void> {
  await screen.findByRole('heading', { name: 'Mis teams' })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
}

function tarjetaDeTeam(nombre: string): HTMLElement {
  const encabezado = screen.getByRole('heading', { name: nombre })
  const tarjeta = encabezado.closest('section')
  if (tarjeta === null) {
    throw new Error(`Sin tarjeta para ${nombre}`)
  }
  return tarjeta
}

describe('listado de teams', () => {
  it('muestra el usuario, cerrar sesion y el titulo de la app', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.getByRole('heading', { name: 'Aniimo Team Tracker' })).toBeInTheDocument()
    expect(screen.getByText('axel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('muestra un team con la tarjeta de Irisalis y tres tarjetas vacias', async () => {
    instalarApi({
      teams: {
        listar: async () => ({
          ok: true,
          teams: [teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })]
        })
      }
    })
    render(<App />)
    await verMisTeams()
    const team = within(tarjetaDeTeam('Principal'))
    expect(team.getByText('Irisalis')).toBeInTheDocument()
    expect(team.getByText('Nivel 60')).toBeInTheDocument()
    expect(team.getByText('CP 3475')).toBeInTheDocument()
    expect(team.getByText('ENFJ')).toBeInTheDocument()
    expect(team.getByText('Estrella 2')).toBeInTheDocument()
    expect(team.getByText('Despertar 28/43')).toBeInTheDocument()
    expect(team.getAllByRole('button', { name: 'Agregar Aniimo' })).toHaveLength(3)
  })

  it('sin teams ofrece Crear team y ninguna tarjeta', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.getByRole('button', { name: 'Crear team' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Agregar Aniimo' })).toBeNull()
  })

  it('con cuatro teams no ofrece Crear team', async () => {
    instalarApi({ teams: { listar: async () => ({ ok: true, teams: CUATRO_TEAMS }) } })
    render(<App />)
    await verMisTeams()
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Crear team' })).toBeNull()
  })

  it('muestra el error de carga y permite reintentar', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    render(<App />)
    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    api.teams.listar.mockResolvedValueOnce({ ok: true, teams: [teamDePrueba('Recargado')] })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { name: 'Recargado' })).toBeInTheDocument()
  })

  it('las tarjetas no usan atributos style', async () => {
    instalarApi({
      teams: {
        listar: async () => ({
          ok: true,
          teams: [teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })]
        })
      }
    })
    const { container } = render(<App />)
    await verMisTeams()
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('crear team', () => {
  it('propone Team N, envia el nombre elegido y recarga la lista', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: true, teams: [teamDePrueba('Principal', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Crear team' }))
    const campo = screen.getByLabelText('Nombre del team') as HTMLInputElement
    expect(campo.value).toBe('Team 2')
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      teams: [teamDePrueba('Principal', 1), teamDePrueba('Raid', 2)]
    })
    fireEvent.change(campo, { target: { value: 'Raid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByRole('heading', { name: 'Raid' })).toBeInTheDocument()
    expect(api.teams.crear).toHaveBeenCalledWith({ nombre: 'Raid' })
    expect(api.teams.listar).toHaveBeenCalledTimes(2)
  })

  it('propone Team 1 cuando no hay teams', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Crear team' }))
    expect((screen.getByLabelText('Nombre del team') as HTMLInputElement).value).toBe('Team 1')
  })

  it('con el maximo de teams alcanzado muestra el mensaje del limite', async () => {
    instalarApi({
      teams: {
        listar: async () => ({ ok: true, teams: [teamDePrueba('Principal', 1)] }),
        crear: async () => ({ ok: false, error: 'limite-de-teams' })
      }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Crear team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByText('Ya tenés el máximo de 4 teams')).toBeInTheDocument()
  })

  it('cancelar cierra el formulario sin llamar a la API', async () => {
    const api = instalarApi()
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Crear team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nombre del team')).toBeNull()
    expect(api.teams.crear).not.toHaveBeenCalled()
  })
})

describe('renombrar team', () => {
  it('envia el nuevo nombre y muestra el que devuelve la recarga', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: true, teams: [teamDePrueba('Viejo', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    api.teams.listar.mockResolvedValueOnce({ ok: true, teams: [teamDePrueba('Nuevo', 1)] })
    fireEvent.change(screen.getByLabelText('Nuevo nombre'), { target: { value: 'Nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(await screen.findByRole('heading', { name: 'Nuevo' })).toBeInTheDocument()
    expect(api.teams.renombrar).toHaveBeenCalledWith({
      teamId: teamDePrueba('Viejo', 1).id,
      nombre: 'Nuevo'
    })
  })

  it('con datos-invalidos muestra el mensaje y conserva el nombre anterior', async () => {
    instalarApi({
      teams: {
        listar: async () => ({ ok: true, teams: [teamDePrueba('Viejo', 1)] }),
        renombrar: async () => ({ ok: false, error: 'datos-invalidos' })
      }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    fireEvent.change(screen.getByLabelText('Nuevo nombre'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(
      await screen.findByText('El nombre del team debe tener entre 1 y 50 caracteres')
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Viejo' })).toBeInTheDocument()
  })
})

describe('borrar team', () => {
  async function abrirBorrado(api = instalarApi({
    teams: { listar: async () => ({ ok: true, teams: [teamDePrueba('Raid', 1)] }) }
  })) {
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar team' }))
    return api
  }

  it('cancelar la confirmacion no llama a la API', async () => {
    const api = await abrirBorrado()
    expect(screen.getByText(/Raid/, { selector: '[role="alertdialog"] *' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.teams.borrar).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Raid' })).toBeInTheDocument()
  })

  it('confirmar borra y recarga la lista sin el team', async () => {
    const api = await abrirBorrado()
    api.teams.listar.mockResolvedValueOnce({ ok: true, teams: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Raid' })).toBeNull())
    expect(api.teams.borrar).toHaveBeenCalledWith({ teamId: teamDePrueba('Raid', 1).id })
  })
})

describe('estado pendiente y sesion', () => {
  it('deshabilita los botones mientras espera la respuesta', async () => {
    let resolver: (valor: { ok: true }) => void = () => undefined
    const api = instalarApi({
      teams: {
        listar: async () => ({ ok: true, teams: [teamDePrueba('Raid', 1)] }),
        borrar: () => new Promise((resolve) => (resolver = resolve))
      }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Renombrar' })).toBeDisabled())
    for (const tarjeta of screen.getAllByRole('button', { name: 'Agregar Aniimo' })) {
      expect(tarjeta).toBeDisabled()
    }
    resolver({ ok: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Renombrar' })).toBeEnabled())
    expect(api.teams.borrar).toHaveBeenCalledTimes(1)
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
    fireEvent.click(screen.getByRole('button', { name: 'Crear team' }))
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

describe('navegacion a la ficha', () => {
  it('abrir una tarjeta vacia muestra la ficha y Cancelar vuelve recargando la lista', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: true, teams: [teamDePrueba('Principal', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getAllByRole('button', { name: 'Agregar Aniimo' })[2]!)
    await screen.findByLabelText('Nombre')
    expect(screen.getByText('Ficha del Aniimo (slot 3)')).toBeInTheDocument()
    expect(api.teams.obtenerFicha).toHaveBeenCalledWith({
      teamId: teamDePrueba('Principal', 1).id,
      slot: 3
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await verMisTeams()
    expect(api.teams.listar).toHaveBeenCalledTimes(2)
  })

  it('guardar un Aniimo nuevo vuelve a Mis teams con la tarjeta actualizada', async () => {
    const api = instalarApi({
      teams: { listar: async () => ({ ok: true, teams: [teamDePrueba('Principal', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getAllByRole('button', { name: 'Agregar Aniimo' })[0]!)
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Irisalis' } })
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      teams: [teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByText('Nivel 60')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mis teams' })).toBeInTheDocument()
  })

  it('sesion vencida desde la ficha vuelve al login con el aviso', async () => {
    instalarApi({
      teams: {
        listar: async () => ({ ok: true, teams: [teamDePrueba('Principal', 1)] }),
        obtenerFicha: async () => ({ ok: false, error: 'sesion-vencida' })
      }
    })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getAllByRole('button', { name: 'Agregar Aniimo' })[0]!)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })
})
