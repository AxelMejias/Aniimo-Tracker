// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BRUNO,
  ID_DE_BRUNO,
  instalarApi,
  type ApiFalsa
} from '../../../../../tests/fixtures/apiFalsa'
import type { ResultadoListarAmigos } from '../../../../shared/amigos'
import App from '../../App'

afterEach(cleanup)

const SIN_CONEXION = 'No se pudo conectar con el servidor. Revisá que el backend esté levantado.'
const CON_UN_AMIGO: ResultadoListarAmigos = {
  ok: true,
  amigos: [BRUNO],
  recibidas: [],
  enviadas: []
}

function irAAmigos(): void {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', {
      name: 'Amigos'
    })
  )
}

async function abrirAmigos(sobrescribir: Parameters<typeof instalarApi>[0] = {}): Promise<ApiFalsa> {
  const api = instalarApi(sobrescribir)
  render(<App />)
  await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
  irAAmigos()
  await screen.findByRole('heading', { level: 2, name: 'Amigos' })
  return api
}

describe('carga y error de las listas de amigos', () => {
  it('antes de la primera respuesta muestra Cargando amigos y no las listas vacias', async () => {
    await abrirAmigos({ amigos: { listar: () => new Promise(() => undefined) } })
    expect(screen.getByText('Cargando amigos…')).toBeInTheDocument()
    expect(screen.queryByText('Todavía no tenés amigos')).toBeNull()
    expect(screen.queryByText('No tenés solicitudes recibidas')).toBeNull()
    expect(screen.queryByText('No enviaste solicitudes')).toBeNull()
  })

  it('con el backend caido muestra el error y Reintentar en vez de las listas', async () => {
    await abrirAmigos({ amigos: { listar: async () => ({ ok: false, error: 'sin-conexion' }) } })
    expect(await screen.findByText(SIN_CONEXION)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(screen.queryByText('Todavía no tenés amigos')).toBeNull()
    expect(screen.queryByText('No tenés solicitudes recibidas')).toBeNull()
  })

  it('Reintentar muestra las listas cuando el backend responde', async () => {
    const api = await abrirAmigos({
      amigos: { listar: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    await screen.findByText(SIN_CONEXION)
    api.amigos.listar.mockResolvedValue(CON_UN_AMIGO)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('bruno')).toBeInTheDocument()
    expect(screen.queryByText(SIN_CONEXION)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('con las listas cargadas no muestra Cargando ni error', async () => {
    await abrirAmigos()
    expect(await screen.findByText('Todavía no tenés amigos')).toBeInTheDocument()
    expect(screen.queryByText('Cargando amigos…')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('la sesion vencida al listar sigue cerrando la sesion', async () => {
    instalarApi({ amigos: { listar: async () => ({ ok: false, error: 'sesion-vencida' }) } })
    render(<App />)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })
})

describe('buscarse a uno mismo', () => {
  function buscar(nombre: string): void {
    fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: nombre } })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  }

  it('el propio nombre con otras mayusculas dice Ese es tu usuario sin llamar al backend', async () => {
    const api = await abrirAmigos()
    buscar('AXEL')
    expect(await screen.findByText('Ese es tu usuario')).toBeInTheDocument()
    expect(screen.queryByText('No hay ningún usuario con ese nombre')).toBeNull()
    expect(api.amigos.buscar).not.toHaveBeenCalled()
  })

  it('otro nombre sigue consultando al backend', async () => {
    const api = await abrirAmigos()
    buscar('bruno')
    expect(await screen.findByText('No hay ningún usuario con ese nombre')).toBeInTheDocument()
    expect(api.amigos.buscar).toHaveBeenCalledWith({ nombreUsuario: 'bruno' })
    expect(screen.queryByText('Ese es tu usuario')).toBeNull()
  })

  it('una busqueda posterior de otro nombre quita el aviso', async () => {
    const api = await abrirAmigos()
    buscar('axel')
    await screen.findByText('Ese es tu usuario')
    buscar('bruno')
    await waitFor(() => expect(api.amigos.buscar).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Ese es tu usuario')).toBeNull()
  })
})

describe('teams de un amigo: reintentar', () => {
  async function abrirTeamsDeBruno(api: Parameters<typeof instalarApi>[0]): Promise<ApiFalsa> {
    const instalada = await abrirAmigos(api)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver teams' }))[0] as HTMLElement)
    return instalada
  }

  it('si falla por sin conexion muestra Reintentar y al reintentar muestra los teams', async () => {
    const api = await abrirTeamsDeBruno({
      amigos: {
        listar: async () => CON_UN_AMIGO,
        listarTeams: async () => ({ ok: false, error: 'sin-conexion' })
      }
    })
    expect(await screen.findByText(SIN_CONEXION)).toBeInTheDocument()
    api.amigos.listarTeams.mockResolvedValue({
      ok: true,
      usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' },
      teams: []
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('bruno todavía no tiene teams para mostrar')).toBeInTheDocument()
    expect(screen.queryByText(SIN_CONEXION)).toBeNull()
  })

  it('si Reintentar vuelve a fallar sigue mostrando el error', async () => {
    const api = await abrirTeamsDeBruno({
      amigos: {
        listar: async () => CON_UN_AMIGO,
        listarTeams: async () => ({ ok: false, error: 'sin-conexion' })
      }
    })
    await screen.findByText(SIN_CONEXION)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(api.amigos.listarTeams).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(SIN_CONEXION)).toBeInTheDocument()
  })
})
