// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { instalarApi } from '../../../tests/fixtures/apiFalsa'
import App from './App'

function instalarApiConSesion(nombreUsuario: string | null): void {
  instalarApi({
    auth: { obtenerSesion: async () => ({ ok: true, nombreUsuario }) }
  })
}

afterEach(cleanup)

describe('App con sesion', () => {
  beforeEach(() => instalarApiConSesion('axel'))

  it('shows the app heading', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Aniimo Team Tracker' })).toBeInTheDocument()
  })

  it('renders no inline style attributes', async () => {
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: 'Aniimo Team Tracker' })
    expect(container.querySelectorAll('[style]').length).toBe(0)
  })
})

describe('App sin sesion', () => {
  beforeEach(() => instalarApiConSesion(null))

  it('shows the app heading in the login screen', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Aniimo Team Tracker' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})
