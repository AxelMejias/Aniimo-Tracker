// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { instalarApi } from '../../../../../tests/fixtures/apiFalsa'
import App from '../../App'
import { leerCuentaDeTest } from './cuentaDeTest'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

const ANONIMO = { ok: true as const, nombreUsuario: null }

function escribir(etiqueta: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

async function irARegistro(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Crear una cuenta' }))
  await screen.findByRole('button', { name: 'Crear cuenta' })
}

describe('estado de carga al abrir', () => {
  it('muestra Cargando mientras la sesion no respondio', () => {
    instalarApi({ auth: { obtenerSesion: () => new Promise(() => undefined) } })
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…')
    expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull()
  })

  it('el estado de carga desaparece cuando responde la sesion', async () => {
    instalarApi({ auth: { obtenerSesion: async () => ANONIMO } })
    render(<App />)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.queryByText('Cargando…')).toBeNull()
  })
})

describe('ayuda del registro', () => {
  it('los requisitos de usuario y contrasena se ven antes de cualquier error', async () => {
    instalarApi({ auth: { obtenerSesion: async () => ANONIMO } })
    render(<App />)
    await irARegistro()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByLabelText('Usuario')).toHaveAccessibleDescription(
      '3 a 32 letras, números o guion bajo.'
    )
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
      'Mínimo 12 caracteres.'
    )
  })

  it('el login no muestra los requisitos del registro', async () => {
    instalarApi({ auth: { obtenerSesion: async () => ANONIMO } })
    render(<App />)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.queryByText('Mínimo 12 caracteres.')).toBeNull()
  })
})

describe('estado de envio', () => {
  it('el login dice Iniciando sesion mientras envia y vuelve al texto normal tras un error', async () => {
    let resolver: (valor: { ok: false; error: 'credenciales-invalidas' }) => void = () => undefined
    instalarApi({
      auth: {
        obtenerSesion: async () => ANONIMO,
        iniciarSesion: () => new Promise((resolve) => (resolver = resolve))
      }
    })
    render(<App />)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    escribir('Usuario', 'axel')
    escribir('Contraseña', 'una-clave-larga')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    const enviando = await screen.findByRole('button', { name: 'Iniciando sesión…' })
    expect(enviando).toBeDisabled()
    resolver({ ok: false, error: 'credenciales-invalidas' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled()
    )
  })

  it('el registro dice Creando cuenta mientras envia y vuelve al texto normal tras un error', async () => {
    let resolver: (valor: { ok: false; error: 'nombre-no-disponible' }) => void = () => undefined
    instalarApi({
      auth: {
        obtenerSesion: async () => ANONIMO,
        registrarse: () => new Promise((resolve) => (resolver = resolve))
      }
    })
    render(<App />)
    await irARegistro()
    escribir('Usuario', 'axel')
    escribir('Contraseña', 'una-clave-larga')
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByRole('button', { name: 'Creando cuenta…' })).toBeDisabled()
    resolver({ ok: false, error: 'nombre-no-disponible' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled())
  })

  it('un login con el backend apagado muestra el mensaje que orienta', async () => {
    instalarApi({
      auth: {
        obtenerSesion: async () => ANONIMO,
        iniciarSesion: async () => ({ ok: false, error: 'sin-conexion' })
      }
    })
    render(<App />)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    escribir('Usuario', 'axel')
    escribir('Contraseña', 'una-clave-larga')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(
      await screen.findByText(
        'No se pudo conectar con el servidor. Revisá que el backend esté levantado.'
      )
    ).toBeInTheDocument()
  })
})

describe('cuenta de test', () => {
  it('devuelve las credenciales en desarrollo con las dos variables', () => {
    vi.stubEnv('VITE_CUENTA_TEST_USUARIO', 'demo_ana')
    vi.stubEnv('VITE_CUENTA_TEST_CONTRASENA', 'una-clave-larga')
    expect(leerCuentaDeTest()).toEqual({
      nombreUsuario: 'demo_ana',
      contrasena: 'una-clave-larga'
    })
  })

  it('devuelve null fuera de desarrollo aunque haya variables', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_CUENTA_TEST_USUARIO', 'demo_ana')
    vi.stubEnv('VITE_CUENTA_TEST_CONTRASENA', 'una-clave-larga')
    expect(leerCuentaDeTest()).toBeNull()
  })

  it.each([
    ['', ''],
    ['demo_ana', ''],
    ['', 'una-clave-larga']
  ])('devuelve null con variables vacias (%j, %j)', (usuario, contrasena) => {
    vi.stubEnv('VITE_CUENTA_TEST_USUARIO', usuario)
    vi.stubEnv('VITE_CUENTA_TEST_CONTRASENA', contrasena)
    expect(leerCuentaDeTest()).toBeNull()
  })
})
