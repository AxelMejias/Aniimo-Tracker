// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDePrueba
} from '../../../../tests/fixtures/apiFalsa'
import { fichaGuardadaDeReferencia } from '../../../../tests/fixtures/ficha'
import App from '../App'

afterEach(cleanup)

const TEAMS_CON_IRISALIS = {
  listar: async () => ({
    ok: true as const,
    teams: [teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })]
  })
}

function navegacion(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Secciones' })
}

function irA(seccion: string): void {
  fireEvent.click(within(navegacion()).getByRole('button', { name: seccion }))
}

async function verMisTeams(): Promise<void> {
  await screen.findByRole('heading', { name: 'Mis teams' })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
}

async function abrirFichaDeIrisalis(): Promise<void> {
  await verMisTeams()
  fireEvent.click(screen.getByRole('button', { name: /Irisalis/ }))
  await screen.findByLabelText('Nombre')
}

const API_CON_FICHA = () =>
  instalarApi({
    teams: {
      ...TEAMS_CON_IRISALIS,
      obtenerFicha: async () => ({ ok: true, ficha: fichaGuardadaDeReferencia() })
    }
  })

describe('foco al navegar', () => {
  it('al ir a Amigos y a Comparar el foco queda en el titulo de la seccion', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    irA('Amigos')
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toHaveFocus()
    irA('Comparar')
    expect(await screen.findByRole('heading', { level: 2, name: 'Comparar' })).toHaveFocus()
    irA('Mis teams')
    expect(await screen.findByRole('heading', { level: 2, name: 'Mis teams' })).toHaveFocus()
  })

  it('al abrir una ficha el foco no queda en el body', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    expect(document.body).not.toHaveFocus()
  })

  it('al abrir la app no roba el foco', async () => {
    instalarApi()
    render(<App />)
    await verMisTeams()
    expect(screen.getByRole('heading', { level: 2, name: 'Mis teams' })).not.toHaveFocus()
  })
})

describe('ficha guardada', () => {
  it('guardar con exito vuelve a Mis teams y muestra Ficha guardada', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await verMisTeams()
    expect(screen.getByRole('status')).toHaveTextContent('Ficha guardada')
  })

  it('navegar a otra seccion limpia el aviso', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await screen.findByText('Ficha guardada')
    irA('Comparar')
    await screen.findByRole('heading', { level: 2, name: 'Comparar' })
    expect(screen.queryByText('Ficha guardada')).toBeNull()
  })

  it('cancelar sin cambios vuelve sin aviso', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await verMisTeams()
    expect(screen.queryByText('Ficha guardada')).toBeNull()
  })
})

describe('descartar cambios de la ficha', () => {
  function tocarNivel(): void {
    fireEvent.change(screen.getByLabelText('Nivel'), { target: { value: '61' } })
  }

  it('Cancelar con cambios pide confirmacion y cancelarla conserva los cambios', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    tocarNivel()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    const dialogo = screen.getByRole('alertdialog')
    expect(within(dialogo).getByText('¿Descartar los cambios de la ficha?')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect((screen.getByLabelText('Nivel') as HTMLInputElement).value).toBe('61')
  })

  it('confirmar vuelve a Mis teams sin guardar', async () => {
    const api = API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    tocarNivel()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    await verMisTeams()
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
    expect(screen.queryByText('Ficha guardada')).toBeNull()
  })

  it('Escape en la confirmacion la cierra y conserva los cambios', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    tocarNivel()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect((screen.getByLabelText('Nivel') as HTMLInputElement).value).toBe('61')
  })

  it.each(['Amigos', 'Comparar'])(
    'ir a %s con cambios pide confirmacion antes de salir',
    async (destino) => {
      API_CON_FICHA()
      render(<App />)
      await abrirFichaDeIrisalis()
      tocarNivel()
      irA(destino)
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByLabelText('Nivel')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
      expect(await screen.findByRole('heading', { level: 2, name: destino })).toBeInTheDocument()
    }
  )

  it('cancelar la confirmacion de la navegacion deja la ficha con sus cambios', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    tocarNivel()
    irA('Amigos')
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' })
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect((screen.getByLabelText('Nivel') as HTMLInputElement).value).toBe('61')
  })

  it('Cerrar sesion con cambios pide confirmacion y confirmar cierra la sesion', async () => {
    const api = API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    tocarNivel()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(api.auth.cerrarSesion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    await waitFor(() => expect(api.auth.cerrarSesion).toHaveBeenCalledTimes(1))
  })

  it('sin cambios la navegacion y Cerrar sesion salen directo', async () => {
    const api = API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    irA('Amigos')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await screen.findByRole('heading', { level: 2, name: 'Amigos' })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await waitFor(() => expect(api.auth.cerrarSesion).toHaveBeenCalledTimes(1))
  })

  it('despues de descartar y volver a abrir la ficha ya no hay cambios pendientes', async () => {
    API_CON_FICHA()
    render(<App />)
    await abrirFichaDeIrisalis()
    tocarNivel()
    irA('Amigos')
    fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }))
    await screen.findByRole('heading', { level: 2, name: 'Amigos' })
    irA('Mis teams')
    await verMisTeams()
    irA('Comparar')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
