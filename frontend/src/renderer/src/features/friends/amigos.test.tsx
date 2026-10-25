// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BRUNO,
  ID_DE_BRUNO,
  ID_DE_CARLA,
  instalarApi,
  SOLICITUD_DE_CARLA,
  type ApiFalsa
} from '../../../../../tests/fixtures/apiFalsa'
import type {
  ResultadoListarAmigos,
  Solicitud,
  UsuarioEncontrado
} from '../../../../shared/amigos'
import App from '../../App'

afterEach(cleanup)

const DARIO: Solicitud = { id: 'd1', nombreUsuario: 'dario', creadaEn: '2026-10-25T12:00:00Z' }
const SIN_NADA: ResultadoListarAmigos = { ok: true, amigos: [], recibidas: [], enviadas: [] }
const TODO: ResultadoListarAmigos = {
  ok: true,
  amigos: [BRUNO],
  recibidas: [SOLICITUD_DE_CARLA],
  enviadas: [DARIO]
}

function usuario(relacion: UsuarioEncontrado['relacion']): UsuarioEncontrado {
  return { id: ID_DE_BRUNO, nombreUsuario: 'bruno', relacion }
}

async function abrirAmigos(sobrescribir: Parameters<typeof instalarApi>[0] = {}): Promise<ApiFalsa> {
  const api = instalarApi(sobrescribir)
  render(<App />)
  await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', {
      name: 'Amigos'
    })
  )
  await screen.findByRole('heading', { level: 2, name: 'Amigos' })
  return api
}

function seccion(nombre: string): HTMLElement {
  return screen.getByRole('region', { name: nombre })
}

function buscar(nombre: string): void {
  fireEvent.change(screen.getByLabelText('Nombre de usuario'), { target: { value: nombre } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
}

describe('pantalla Amigos: contenido', () => {
  it('muestra el aviso de privacidad con los dos controles', async () => {
    await abrirAmigos()
    expect(
      screen.getByText(
        'Tus amigos aceptados ven tus teams y fichas completas, incluidas las notas. ' +
          'Podés ocultar un team con «Oculto para amigos» y las notas de un Aniimo con «Notas privadas».'
      )
    ).toBeInTheDocument()
  })

  it('muestra recibidas, enviadas y amigos desde el estado centralizado', async () => {
    await abrirAmigos({ amigos: { listar: async () => TODO } })
    expect(await within(seccion('Recibidas')).findByText('carla')).toBeInTheDocument()
    expect(within(seccion('Enviadas')).getByText('dario')).toBeInTheDocument()
    expect(within(seccion('Tus amigos')).getByText('bruno')).toBeInTheDocument()
  })

  it('las listas vacias muestran un texto y no botones de accion', async () => {
    await abrirAmigos()
    expect(within(seccion('Recibidas')).getByText('No tenés solicitudes recibidas')).toBeInTheDocument()
    expect(within(seccion('Enviadas')).getByText('No enviaste solicitudes')).toBeInTheDocument()
    expect(within(seccion('Tus amigos')).getByText('Todavía no tenés amigos')).toBeInTheDocument()
  })

  it('Actualizar vuelve a pedir las listas', async () => {
    const api = await abrirAmigos()
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalled())
    api.amigos.listar.mockClear()
    api.amigos.listar.mockResolvedValue(TODO)
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await within(seccion('Recibidas')).findByText('carla')).toBeInTheDocument()
    expect(api.amigos.listar).toHaveBeenCalledTimes(1)
  })

  it('no usa atributos style', async () => {
    await abrirAmigos({ amigos: { listar: async () => TODO } })
    await within(seccion('Recibidas')).findByText('carla')
    expect(document.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('pantalla Amigos: buscar', () => {
  it('buscar llama a la API con el nombre y ofrece Enviar solicitud si no hay relacion', async () => {
    const api = await abrirAmigos({
      amigos: { buscar: async () => ({ ok: true, usuario: usuario('ninguna') }) }
    })
    buscar('bruno')
    expect(await screen.findByRole('button', { name: 'Enviar solicitud' })).toBeInTheDocument()
    expect(api.amigos.buscar).toHaveBeenCalledWith({ nombreUsuario: 'bruno' })
  })

  it('un nombre mal formado no llama a la API y explica el formato', async () => {
    const api = await abrirAmigos()
    buscar('ab')
    expect(
      await screen.findByText(
        'El nombre de usuario debe tener entre 3 y 32 letras, números o guiones bajos'
      )
    ).toBeInTheDocument()
    expect(api.amigos.buscar).not.toHaveBeenCalled()
  })

  it('sin resultado muestra que no hay ningun usuario con ese nombre', async () => {
    await abrirAmigos({ amigos: { buscar: async () => ({ ok: true, usuario: null }) } })
    buscar('nadie')
    expect(await screen.findByText('No hay ningún usuario con ese nombre')).toBeInTheDocument()
  })

  it.each([
    ['solicitud-enviada', 'Solicitud enviada', null],
    ['solicitud-recibida', null, 'Aceptar'],
    ['amigo', 'Ya son amigos', null]
  ] as const)('con relacion %s ofrece la accion que corresponde', async (relacion, texto, boton) => {
    await abrirAmigos({
      amigos: { buscar: async () => ({ ok: true, usuario: usuario(relacion) }) }
    })
    buscar('bruno')
    const resultado = await screen.findByRole('region', { name: 'Resultado de la búsqueda' })
    expect(within(resultado).getByText('bruno')).toBeInTheDocument()
    expect(within(resultado).queryByRole('button', { name: 'Enviar solicitud' })).toBeNull()
    if (texto !== null) {
      expect(within(resultado).getByText(texto)).toBeInTheDocument()
      expect(within(resultado).queryByRole('button')).toBeNull()
    }
    if (boton !== null) {
      expect(within(resultado).getByRole('button', { name: boton })).toBeInTheDocument()
    }
  })

  it('enviar solicitud llama con el id y bruno aparece en Enviadas', async () => {
    const api = await abrirAmigos({
      amigos: { buscar: async () => ({ ok: true, usuario: usuario('ninguna') }) }
    })
    buscar('bruno')
    api.amigos.listar.mockResolvedValue({
      ...SIN_NADA,
      enviadas: [{ id: ID_DE_BRUNO, nombreUsuario: 'bruno', creadaEn: '2026-10-25T13:00:00Z' }]
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar solicitud' }))
    expect(await within(seccion('Enviadas')).findByText('bruno')).toBeInTheDocument()
    expect(api.amigos.enviarSolicitud).toHaveBeenCalledWith({ usuarioId: ID_DE_BRUNO })
    const resultado = screen.getByRole('region', { name: 'Resultado de la búsqueda' })
    expect(within(resultado).getByText('Solicitud enviada')).toBeInTheDocument()
  })

  it('aceptar desde el resultado de busqueda llama a aceptar', async () => {
    const api = await abrirAmigos({
      amigos: { buscar: async () => ({ ok: true, usuario: usuario('solicitud-recibida') }) }
    })
    buscar('bruno')
    const resultado = await screen.findByRole('region', { name: 'Resultado de la búsqueda' })
    fireEvent.click(within(resultado).getByRole('button', { name: 'Aceptar' }))
    await waitFor(() =>
      expect(api.amigos.aceptarSolicitud).toHaveBeenCalledWith({ usuarioId: ID_DE_BRUNO })
    )
  })

  it('ya-existe muestra el mensaje y recarga las listas', async () => {
    const api = await abrirAmigos({
      amigos: {
        buscar: async () => ({ ok: true, usuario: usuario('ninguna') }),
        enviarSolicitud: async () => ({ ok: false, error: 'ya-existe' })
      }
    })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalled())
    buscar('bruno')
    const antes = api.amigos.listar.mock.calls.length
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar solicitud' }))
    expect(
      await screen.findByText('Ya hay una solicitud o amistad con ese usuario')
    ).toBeInTheDocument()
    await waitFor(() => expect(api.amigos.listar.mock.calls.length).toBeGreaterThan(antes))
  })
})

describe('pantalla Amigos: solicitudes y amigos', () => {
  it('aceptar llama a aceptar y carla pasa a Tus amigos', async () => {
    const api = await abrirAmigos({ amigos: { listar: async () => TODO } })
    await within(seccion('Recibidas')).findByText('carla')
    api.amigos.listar.mockResolvedValue({
      ok: true,
      amigos: [BRUNO, { id: ID_DE_CARLA, nombreUsuario: 'carla', desde: '2026-10-25T14:00:00Z' }],
      recibidas: [],
      enviadas: [DARIO]
    })
    fireEvent.click(within(seccion('Recibidas')).getByRole('button', { name: 'Aceptar' }))
    expect(await within(seccion('Tus amigos')).findByText('carla')).toBeInTheDocument()
    expect(api.amigos.aceptarSolicitud).toHaveBeenCalledWith({ usuarioId: ID_DE_CARLA })
    expect(within(seccion('Recibidas')).queryByText('carla')).toBeNull()
  })

  it('rechazar llama a eliminar y desaparece de Recibidas', async () => {
    const api = await abrirAmigos({ amigos: { listar: async () => TODO } })
    await within(seccion('Recibidas')).findByText('carla')
    api.amigos.listar.mockResolvedValue({ ...TODO, recibidas: [] })
    fireEvent.click(within(seccion('Recibidas')).getByRole('button', { name: 'Rechazar' }))
    await waitFor(() => expect(within(seccion('Recibidas')).queryByText('carla')).toBeNull())
    expect(api.amigos.eliminar).toHaveBeenCalledWith({ usuarioId: ID_DE_CARLA })
  })

  it('cancelar una enviada llama a eliminar y desaparece de Enviadas', async () => {
    const api = await abrirAmigos({ amigos: { listar: async () => TODO } })
    await within(seccion('Enviadas')).findByText('dario')
    api.amigos.listar.mockResolvedValue({ ...TODO, enviadas: [] })
    fireEvent.click(within(seccion('Enviadas')).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(within(seccion('Enviadas')).queryByText('dario')).toBeNull())
    expect(api.amigos.eliminar).toHaveBeenCalledWith({ usuarioId: 'd1' })
  })

  it('eliminar un amigo: cancelar la confirmacion no llama a la API', async () => {
    const api = await abrirAmigos({ amigos: { listar: async () => TODO } })
    await within(seccion('Tus amigos')).findByText('bruno')
    fireEvent.click(within(seccion('Tus amigos')).getByRole('button', { name: 'Eliminar' }))
    expect(within(seccion('Tus amigos')).getByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(within(seccion('Tus amigos')).getByRole('button', { name: 'Cancelar' }))
    expect(api.amigos.eliminar).not.toHaveBeenCalled()
    expect(within(seccion('Tus amigos')).queryByRole('alertdialog')).toBeNull()
  })

  it('eliminar un amigo: confirmar llama a eliminar y la lista se recarga sin el', async () => {
    const api = await abrirAmigos({ amigos: { listar: async () => TODO } })
    await within(seccion('Tus amigos')).findByText('bruno')
    fireEvent.click(within(seccion('Tus amigos')).getByRole('button', { name: 'Eliminar' }))
    api.amigos.listar.mockResolvedValue({ ...TODO, amigos: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))
    await waitFor(() => expect(within(seccion('Tus amigos')).queryByText('bruno')).toBeNull())
    expect(api.amigos.eliminar).toHaveBeenCalledWith({ usuarioId: ID_DE_BRUNO })
  })

  it('los botones quedan deshabilitados mientras espera la respuesta', async () => {
    let resolver: (valor: { ok: true }) => void = () => undefined
    const api = await abrirAmigos({
      amigos: {
        listar: async () => TODO,
        eliminar: () => new Promise((resolve) => (resolver = resolve))
      }
    })
    await within(seccion('Recibidas')).findByText('carla')
    fireEvent.click(within(seccion('Recibidas')).getByRole('button', { name: 'Rechazar' }))
    await waitFor(() =>
      expect(within(seccion('Recibidas')).getByRole('button', { name: 'Aceptar' })).toBeDisabled()
    )
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled()
    resolver({ ok: true })
    await waitFor(() =>
      expect(within(seccion('Recibidas')).getByRole('button', { name: 'Aceptar' })).toBeEnabled()
    )
    expect(api.amigos.eliminar).toHaveBeenCalledTimes(1)
  })

  it('un error de la accion muestra el mensaje y conserva las listas', async () => {
    await abrirAmigos({
      amigos: {
        listar: async () => TODO,
        aceptarSolicitud: async () => ({ ok: false, error: 'sin-conexion' })
      }
    })
    await within(seccion('Recibidas')).findByText('carla')
    fireEvent.click(within(seccion('Recibidas')).getByRole('button', { name: 'Aceptar' }))
    expect(await screen.findByText('No se pudo conectar con el servidor. Revisá que el backend esté levantado.')).toBeInTheDocument()
    expect(within(seccion('Recibidas')).getByText('carla')).toBeInTheDocument()
  })

  it.each([
    ['buscar', () => buscar('bruno'), { buscar: async () => ({ ok: false, error: 'sesion-vencida' }) }],
    [
      'aceptar',
      () => fireEvent.click(within(seccion('Recibidas')).getByRole('button', { name: 'Aceptar' })),
      {
        listar: async () => TODO,
        aceptarSolicitud: async () => ({ ok: false, error: 'sesion-vencida' })
      }
    ]
  ] as const)('sesion-vencida al %s vuelve al login con el aviso', async (_nombre, accion, amigos) => {
    await abrirAmigos({ amigos: amigos as never })
    if (_nombre === 'aceptar') {
      await within(seccion('Recibidas')).findByText('carla')
    }
    accion()
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it('Ver teams abre los teams del amigo', async () => {
    const api = await abrirAmigos({ amigos: { listar: async () => TODO } })
    await within(seccion('Tus amigos')).findByText('bruno')
    fireEvent.click(within(seccion('Tus amigos')).getByRole('button', { name: 'Ver teams' }))
    await waitFor(() =>
      expect(api.amigos.listarTeams).toHaveBeenCalledWith({ usuarioId: ID_DE_BRUNO })
    )
  })
})
