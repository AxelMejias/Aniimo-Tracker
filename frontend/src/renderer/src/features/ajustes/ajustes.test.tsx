// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { instalarApi } from '../../../../../tests/fixtures/apiFalsa'
import type { Preferencias, ResultadoPreferencias } from '../../../../shared/preferencias'
import App from '../../App'

afterEach(cleanup)

const APAGADAS: Preferencias = {
  abrirAppConElJuego: false,
  arrancarConWindows: false,
  segundoPlanoDisponible: true
}

function respuesta(cambios: Partial<Preferencias> = {}): ResultadoPreferencias {
  return { ok: true, preferencias: { ...APAGADAS, ...cambios } }
}

async function abrirAjustes(): Promise<void> {
  const barra = await screen.findByRole('complementary')
  fireEvent.click(within(barra).getByRole('button', { name: 'Ajustes' }))
  await screen.findByRole('heading', { level: 2, name: 'Ajustes' })
}

const DETECCION = 'Abrir la app cuando arranca Aniimo'
const SEGUNDO_PLANO = 'Arrancar con Windows en segundo plano'

describe('boton Ajustes', () => {
  it('esta en la barra al lado de Cerrar sesion', async () => {
    instalarApi()
    render(<App />)
    const barra = await screen.findByRole('complementary')
    const ajustes = within(barra).getByRole('button', { name: 'Ajustes' })
    const cerrar = within(barra).getByRole('button', { name: 'Cerrar sesión' })
    expect(ajustes.parentElement).toBe(cerrar.parentElement)
  })

  it('abre la vista con las dos casillas apagadas por defecto', async () => {
    instalarApi()
    render(<App />)
    await abrirAjustes()
    expect(screen.getByRole('checkbox', { name: DETECCION })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: SEGUNDO_PLANO })).not.toBeChecked()
  })

  it('no deja ninguna seccion de la navegacion marcada como actual', async () => {
    instalarApi()
    render(<App />)
    await abrirAjustes()
    const navegacion = screen.getByRole('navigation', { name: 'Secciones' })
    expect(navegacion.querySelector('[aria-current]')).toBeNull()
  })
})

describe('estado inicial', () => {
  it('refleja las preferencias que devuelve el main', async () => {
    instalarApi({
      preferencias: { obtener: async () => respuesta({ abrirAppConElJuego: true, arrancarConWindows: true }) }
    })
    render(<App />)
    await abrirAjustes()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: DETECCION })).toBeChecked())
    expect(screen.getByRole('checkbox', { name: SEGUNDO_PLANO })).toBeChecked()
  })

  it('deshabilita Arrancar con Windows si el segundo plano no esta disponible', async () => {
    instalarApi({
      preferencias: { obtener: async () => respuesta({ segundoPlanoDisponible: false }) }
    })
    render(<App />)
    await abrirAjustes()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: SEGUNDO_PLANO })).toBeDisabled())
    expect(screen.getByRole('checkbox', { name: DETECCION })).toBeEnabled()
  })

  it('con el segundo plano disponible la casilla esta habilitada', async () => {
    instalarApi()
    render(<App />)
    await abrirAjustes()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: SEGUNDO_PLANO })).toBeEnabled())
  })
})

describe('textos de ayuda', () => {
  it('la deteccion dice que solo mira la lista de programas y no toca el juego', async () => {
    instalarApi()
    render(<App />)
    await abrirAjustes()
    const casilla = screen.getByRole('checkbox', { name: DETECCION })
    expect(casilla).toHaveAccessibleDescription(
      'La app se fija cada 5 segundos en la lista de programas abiertos de Windows (lo mismo que ves en el Administrador de tareas) para saber si Aniimo está abierto. No lee, no toca y no se mete en el juego. Muestra la ventana de la app sin sacarle el teclado al juego; si no iniciaste sesión, ves el login.'
    )
  })

  it('el segundo plano explica el icono del area de notificacion', async () => {
    instalarApi()
    render(<App />)
    await abrirAjustes()
    expect(screen.getByRole('checkbox', { name: SEGUNDO_PLANO })).toHaveAccessibleDescription(
      'La app arranca sola al prender la PC y queda en el área de notificación, sin ventana. La podés cerrar desde el ícono con «Salir».'
    )
  })
})

describe('cambiar una casilla', () => {
  it('encender la deteccion llama a cambiar con la clave y el valor', async () => {
    const api = instalarApi({
      preferencias: { cambiar: async () => respuesta({ abrirAppConElJuego: true }) }
    })
    render(<App />)
    await abrirAjustes()
    fireEvent.click(screen.getByRole('checkbox', { name: DETECCION }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: DETECCION })).toBeChecked())
    expect(api.preferencias.cambiar).toHaveBeenCalledWith({
      clave: 'abrirAppConElJuego',
      valor: true
    })
  })

  it('encender el segundo plano llama a cambiar con arrancarConWindows', async () => {
    const api = instalarApi({
      preferencias: { cambiar: async () => respuesta({ arrancarConWindows: true }) }
    })
    render(<App />)
    await abrirAjustes()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: SEGUNDO_PLANO })).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox', { name: SEGUNDO_PLANO }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: SEGUNDO_PLANO })).toBeChecked())
    expect(api.preferencias.cambiar).toHaveBeenCalledWith({
      clave: 'arrancarConWindows',
      valor: true
    })
  })

  it('apagar una casilla encendida envia valor false', async () => {
    const api = instalarApi({
      preferencias: {
        obtener: async () => respuesta({ abrirAppConElJuego: true }),
        cambiar: async () => respuesta()
      }
    })
    render(<App />)
    await abrirAjustes()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: DETECCION })).toBeChecked())
    fireEvent.click(screen.getByRole('checkbox', { name: DETECCION }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: DETECCION })).not.toBeChecked())
    expect(api.preferencias.cambiar).toHaveBeenCalledWith({
      clave: 'abrirAppConElJuego',
      valor: false
    })
  })

  it('si falla muestra el error y deja la casilla como estaba', async () => {
    instalarApi({
      preferencias: { cambiar: async () => ({ ok: false, error: 'error-inesperado' }) }
    })
    render(<App />)
    await abrirAjustes()
    fireEvent.click(screen.getByRole('checkbox', { name: DETECCION }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio')
    expect(screen.getByRole('checkbox', { name: DETECCION })).not.toBeChecked()
  })

  it('si no se puede leer muestra un error', async () => {
    instalarApi({
      preferencias: { obtener: async () => ({ ok: false, error: 'error-inesperado' }) }
    })
    render(<App />)
    await abrirAjustes()
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron leer los ajustes')
  })
})

describe('estilos', () => {
  it('no usa estilos inline', async () => {
    instalarApi()
    const { container } = render(<App />)
    await abrirAjustes()
    expect(container.querySelector('[style]')).toBeNull()
  })
})
