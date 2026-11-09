// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { instalarApi, teamDePrueba } from '../../../../../tests/fixtures/apiFalsa'
import App from '../../App'
import { MENSAJE_NOMBRE_DE_TEAM_INVALIDO } from './mensajes'

afterEach(cleanup)

const TEXTO_VACIO = 'Todavía no tenés teams. Creá el primero (podés tener hasta 20).'
const TEXTO_MAXIMO = 'Llegaste al máximo de 20 teams.'

async function verMisTeams(): Promise<void> {
  await screen.findByRole('heading', { name: 'Mis teams' })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
}

describe('estado vacio y maximo de teams', () => {
  it('sin teams explica como empezar y ofrece Nuevo team', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.getByText(TEXTO_VACIO)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo team' })).toBeInTheDocument()
    expect(screen.queryByText(TEXTO_MAXIMO)).toBeNull()
  })

  it('con veinte teams no hay Nuevo team y se avisa el maximo', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => teamDePrueba(`Team ${i + 1}`, i + 1))
    instalarApi({ teams: { listar: async () => ({ ok: true, grupos: [], teams: veinte }) } })
    render(<App />)
    await verMisTeams()
    expect(screen.queryByRole('button', { name: 'Nuevo team' })).toBeNull()
    expect(screen.getByText(TEXTO_MAXIMO)).toBeInTheDocument()
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull()
  })

  it('con uno a tres teams no muestra ninguno de los dos textos', async () => {
    instalarApi({
      teams: { listar: async () => ({ ok: true, grupos: [], teams: [teamDePrueba('Principal', 1)] }) }
    })
    render(<App />)
    await verMisTeams()
    expect(screen.queryByText(TEXTO_VACIO)).toBeNull()
    expect(screen.queryByText(TEXTO_MAXIMO)).toBeNull()
    expect(screen.getByRole('button', { name: 'Nuevo team' })).toBeInTheDocument()
  })
})

describe('nombre de team invalido', () => {
  it('crear con datos-invalidos muestra el mismo mensaje que renombrar', async () => {
    instalarApi({ teams: { crear: async () => ({ ok: false, error: 'datos-invalidos' }) } })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByText(MENSAJE_NOMBRE_DE_TEAM_INVALIDO)).toBeInTheDocument()
    expect(screen.queryByText('Revisá los datos ingresados')).toBeNull()
  })

  it('otros errores de crear siguen con su mensaje propio', async () => {
    instalarApi({ teams: { crear: async () => ({ ok: false, error: 'limite-de-teams' }) } })
    render(<App />)
    await verMisTeams()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(await screen.findByText('Ya tenés el máximo de 20 teams')).toBeInTheDocument()
  })
})
