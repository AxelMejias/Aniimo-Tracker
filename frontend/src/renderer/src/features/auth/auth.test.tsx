// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuthApi } from '../../../../preload/api'
import type { ResultadoAuth, ResultadoSesion } from '../../../../shared/auth'
import App from '../../App'

const ANONIMO: ResultadoSesion = { ok: true, nombreUsuario: null }
const ENTRA_AXEL: ResultadoAuth = { ok: true, nombreUsuario: 'axel' }

function instalarApi(sobrescribir: Partial<AuthApi> = {}) {
  const auth = {
    obtenerSesion: vi.fn(async (): Promise<ResultadoSesion> => ANONIMO),
    iniciarSesion: vi.fn(async (): Promise<ResultadoAuth> => ENTRA_AXEL),
    registrarse: vi.fn(async (): Promise<ResultadoAuth> => ENTRA_AXEL),
    cerrarSesion: vi.fn(async (): Promise<ResultadoSesion> => ANONIMO),
    ...sobrescribir
  }
  Object.defineProperty(window, 'aniimo', {
    value: {
      appName: 'Aniimo Team Tracker',
      auth,
      teams: { listar: async () => ({ ok: true, teams: [] }) }
    },
    configurable: true,
    writable: true
  })
  return auth
}

function escribir(etiqueta: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

function campoContrasena(): HTMLInputElement {
  return screen.getByLabelText('Contraseña') as HTMLInputElement
}

async function verLogin(): Promise<void> {
  await screen.findByRole('button', { name: 'Iniciar sesión' })
}

async function irARegistro(): Promise<void> {
  await verLogin()
  fireEvent.click(screen.getByRole('button', { name: 'Crear una cuenta' }))
  await screen.findByRole('button', { name: 'Crear cuenta' })
}

async function enviarLogin(nombre = 'axel', contrasena = 'una-clave-larga'): Promise<void> {
  await verLogin()
  escribir('Usuario', nombre)
  escribir('Contraseña', contrasena)
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
}

async function enviarRegistro(nombre: string, contrasena: string): Promise<void> {
  await irARegistro()
  escribir('Usuario', nombre)
  escribir('Contraseña', contrasena)
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
}

afterEach(cleanup)

describe('arranque', () => {
  it('sin sesion muestra el formulario de login', async () => {
    instalarApi()
    render(<App />)
    await verLogin()
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument()
  })

  it('con sesion activa entra directo a la pantalla inicial', async () => {
    instalarApi({ obtenerSesion: async () => ({ ok: true, nombreUsuario: 'axel' }) })
    render(<App />)
    expect(await screen.findByText('axel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
  })

  it('una sesion vencida vuelve al login con el aviso', async () => {
    instalarApi({ obtenerSesion: async () => ({ ok: false, error: 'sesion-vencida' }) })
    render(<App />)
    await verLogin()
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it('sin conexion al arrancar avisa en el login', async () => {
    instalarApi({ obtenerSesion: async () => ({ ok: false, error: 'sin-conexion' }) })
    render(<App />)
    await verLogin()
    expect(screen.getByText('No se pudo conectar con el servidor')).toBeInTheDocument()
  })
})

describe('login', () => {
  it('un login exitoso muestra la pantalla inicial con el nombre y Cerrar sesion', async () => {
    const auth = instalarApi()
    render(<App />)
    await enviarLogin('Axel', 'una-clave-larga')
    expect(await screen.findByText('axel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument()
    expect(auth.iniciarSesion).toHaveBeenCalledWith({
      nombreUsuario: 'Axel',
      contrasena: 'una-clave-larga'
    })
  })

  it('credenciales invalidas muestra el mensaje y vacia la contrasena', async () => {
    instalarApi({ iniciarSesion: async () => ({ ok: false, error: 'credenciales-invalidas' }) })
    render(<App />)
    await enviarLogin()
    expect(await screen.findByText('Usuario o contraseña incorrectos')).toBeInTheDocument()
    expect(campoContrasena().value).toBe('')
    expect((screen.getByLabelText('Usuario') as HTMLInputElement).value).toBe('axel')
  })

  it('demasiados intentos muestra el mensaje con la espera en minutos', async () => {
    instalarApi({
      iniciarSesion: async () => ({
        ok: false,
        error: 'demasiados-intentos',
        reintentarEnSegundos: 120
      })
    })
    render(<App />)
    await enviarLogin()
    const mensaje = await screen.findByRole('alert')
    expect(mensaje).toHaveTextContent('Demasiados intentos')
    expect(mensaje).toHaveTextContent('2 minutos')
  })

  it('demasiados intentos sin espera informada muestra el mensaje general', async () => {
    instalarApi({ iniciarSesion: async () => ({ ok: false, error: 'demasiados-intentos' }) })
    render(<App />)
    await enviarLogin()
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos')
  })

  it.each([
    ['sin-conexion', 'No se pudo conectar con el servidor'],
    ['error-inesperado', 'Ocurrió un error inesperado'],
    ['datos-invalidos', 'Revisá los datos ingresados']
  ] as const)('el codigo %s muestra su mensaje en espanol', async (codigo, texto) => {
    instalarApi({ iniciarSesion: async () => ({ ok: false, error: codigo }) })
    render(<App />)
    await enviarLogin()
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })

  it('con campos vacios no llama a la API', async () => {
    const auth = instalarApi()
    render(<App />)
    await verLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Completá usuario y contraseña')
    expect(auth.iniciarSesion).not.toHaveBeenCalled()
  })

  it('un error posterior reemplaza al anterior y uno exitoso lo limpia', async () => {
    const iniciarSesion = vi
      .fn<AuthApi['iniciarSesion']>()
      .mockResolvedValueOnce({ ok: false, error: 'credenciales-invalidas' })
      .mockResolvedValueOnce({ ok: false, error: 'sin-conexion' })
    instalarApi({ iniciarSesion })
    render(<App />)
    await enviarLogin()
    await screen.findByText('Usuario o contraseña incorrectos')
    escribir('Contraseña', 'otra-clave-larga')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByText('No se pudo conectar con el servidor')
    expect(screen.queryByText('Usuario o contraseña incorrectos')).not.toBeInTheDocument()
  })
})

describe('registro', () => {
  it('un registro valido entra autenticado', async () => {
    const auth = instalarApi()
    render(<App />)
    await enviarRegistro('Axel', 'una-clave-larga')
    expect(await screen.findByText('axel')).toBeInTheDocument()
    expect(auth.registrarse).toHaveBeenCalledWith({
      nombreUsuario: 'Axel',
      contrasena: 'una-clave-larga'
    })
  })

  it.each(['12345678', 'a'.repeat(11)])(
    'una contrasena corta (%s) muestra el minimo de 12 y no llama a la API',
    async (contrasena) => {
      const auth = instalarApi()
      render(<App />)
      await enviarRegistro('axel', contrasena)
      expect(await screen.findByRole('alert')).toHaveTextContent('12 caracteres')
      expect(auth.registrarse).not.toHaveBeenCalled()
    }
  )

  it('una contrasena de mas de 128 muestra el maximo y no llama a la API', async () => {
    const auth = instalarApi()
    render(<App />)
    await enviarRegistro('axel', 'a'.repeat(129))
    expect(await screen.findByRole('alert')).toHaveTextContent('128 caracteres')
    expect(auth.registrarse).not.toHaveBeenCalled()
  })

  it.each(['axel mejias', 'ax', 'a'.repeat(33), 'axel!'])(
    'el nombre invalido "%s" muestra el mensaje de alfabeto y no llama a la API',
    async (nombre) => {
      const auth = instalarApi()
      render(<App />)
      await enviarRegistro(nombre, 'una-clave-larga')
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'letras, números y guion bajo'
      )
      expect(auth.registrarse).not.toHaveBeenCalled()
    }
  )

  it('un nombre no disponible muestra su mensaje y vacia la contrasena', async () => {
    instalarApi({ registrarse: async () => ({ ok: false, error: 'nombre-no-disponible' }) })
    render(<App />)
    await enviarRegistro('axel', 'una-clave-larga')
    expect(await screen.findByText('El nombre de usuario no está disponible')).toBeInTheDocument()
    expect(campoContrasena().value).toBe('')
  })

  it('si el login automatico esta bloqueado muestra demasiados intentos', async () => {
    instalarApi({ registrarse: async () => ({ ok: false, error: 'demasiados-intentos' }) })
    render(<App />)
    await enviarRegistro('axel', 'una-clave-larga')
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos')
  })

  it('se puede volver del registro al login', async () => {
    instalarApi()
    render(<App />)
    await irARegistro()
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo cuenta' }))
    await verLogin()
  })
})

describe('cerrar sesion', () => {
  it('llama a cerrar sesion y vuelve al login', async () => {
    const auth = instalarApi({ obtenerSesion: async () => ({ ok: true, nombreUsuario: 'axel' }) })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    await verLogin()
    expect(auth.cerrarSesion).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('axel')).not.toBeInTheDocument()
  })
})

describe('formularios', () => {
  it('los campos de contrasena son de tipo password en login y registro', async () => {
    instalarApi()
    render(<App />)
    await verLogin()
    expect(campoContrasena()).toHaveAttribute('type', 'password')
    expect(campoContrasena()).toHaveAttribute('autocomplete', 'current-password')
    fireEvent.click(screen.getByRole('button', { name: 'Crear una cuenta' }))
    await screen.findByRole('button', { name: 'Crear cuenta' })
    expect(campoContrasena()).toHaveAttribute('type', 'password')
    expect(campoContrasena()).toHaveAttribute('autocomplete', 'new-password')
  })

  it('ningun elemento de login ni registro tiene atributo style', async () => {
    instalarApi()
    const { container } = render(<App />)
    await verLogin()
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Crear una cuenta' }))
    await screen.findByRole('button', { name: 'Crear cuenta' })
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })

  it('no guarda datos de auth en localStorage ni sessionStorage', async () => {
    instalarApi()
    render(<App />)
    await enviarLogin()
    await screen.findByText('axel')
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('deshabilita el envio mientras la peticion esta en curso', async () => {
    let terminar: (resultado: ResultadoAuth) => void = () => undefined
    const auth = instalarApi({
      iniciarSesion: vi.fn(
        () => new Promise<ResultadoAuth>((resolver) => (terminar = resolver))
      )
    })
    render(<App />)
    await enviarLogin()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(auth.iniciarSesion).toHaveBeenCalledTimes(1)
    terminar(ENTRA_AXEL)
    await screen.findByText('axel')
  })
})
