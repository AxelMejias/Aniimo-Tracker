// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

function instalarApi(nombreUsuario: string | null): void {
  Object.defineProperty(window, 'aniimo', {
    value: {
      appName: 'Aniimo Team Tracker',
      auth: {
        obtenerSesion: async () => ({ ok: true, nombreUsuario }),
        iniciarSesion: async () => ({ ok: false, error: 'error-inesperado' }),
        registrarse: async () => ({ ok: false, error: 'error-inesperado' }),
        cerrarSesion: async () => ({ ok: true, nombreUsuario: null })
      }
    },
    configurable: true,
    writable: true
  })
}

afterEach(cleanup)

describe('App con sesion', () => {
  beforeEach(() => instalarApi('axel'))

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
  beforeEach(() => instalarApi(null))

  it('shows the app heading in the login screen', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Aniimo Team Tracker' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})
