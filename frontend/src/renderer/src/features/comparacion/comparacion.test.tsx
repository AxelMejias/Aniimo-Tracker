// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BRUNO,
  fichaDeAmigoDePrueba,
  ID_DE_BRUNO,
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDeAmigoDePrueba,
  teamDePrueba,
  type ApiFalsa
} from '../../../../../tests/fixtures/apiFalsa'
import { fichaGuardadaDeReferencia } from '../../../../../tests/fixtures/ficha'
import type { AmigosApi, TeamsApi } from '../../../../preload/api'
import type { ResultadoFichaDeAmigo } from '../../../../shared/amigos'
import type { ResultadoFicha } from '../../../../shared/teams'
import App from '../../App'

afterEach(cleanup)

const OTRO_RESUMEN = { ...RESUMEN_DE_IRISALIS, nombre: 'Voltix', cp: 3600, nivel: 61 }
const MIO = teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })
const MIO_OCULTO = teamDePrueba('Reservado', 2, {}, true)
const DE_BRUNO = teamDeAmigoDePrueba('Raid', 3, { 1: OTRO_RESUMEN, 2: OTRO_RESUMEN })

function apiBase(
  amigos: Partial<AmigosApi> = {},
  teams: Partial<TeamsApi> = {}
): Parameters<typeof instalarApi>[0] {
  return {
    teams: {
      listar: async () => ({ ok: true, teams: [MIO, MIO_OCULTO] }),
      obtenerFicha: async () => ({ ok: true, ficha: fichaGuardadaDeReferencia() }),
      ...teams
    },
    amigos: {
      listar: async () => ({ ok: true, amigos: [BRUNO], recibidas: [], enviadas: [] }),
      listarTeams: async () => ({
        ok: true,
        usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' },
        teams: [DE_BRUNO]
      }),
      obtenerFicha: async () => ({
        ok: true,
        ficha: fichaDeAmigoDePrueba({ nombre: 'Voltix', cp: 3600, slot: 2 })
      }),
      ...amigos
    }
  }
}

function navegar(seccion: string): void {
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', {
      name: seccion
    })
  )
}

async function abrirComparar(sobrescribir = apiBase()): Promise<ApiFalsa> {
  const api = instalarApi(sobrescribir)
  render(<App />)
  await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
  navegar('Comparar')
  await screen.findByRole('heading', { level: 2, name: 'Comparar' })
  return api
}

function lado(nombre: 'izquierdo' | 'derecho'): HTMLElement {
  return screen.getByRole('group', { name: `Lado ${nombre}` })
}

function elegirTexto(select: HTMLElement, texto: string): void {
  const opcion = within(select).getByRole('option', { name: texto }) as HTMLOptionElement
  fireEvent.change(select, { target: { value: opcion.value } })
}

async function elegir(
  nombre: 'izquierdo' | 'derecho',
  seleccion: { duenio: string; team: string; slot?: string }
): Promise<void> {
  const grupo = lado(nombre)
  elegirTexto(within(grupo).getByLabelText('Dueño'), seleccion.duenio)
  await within(grupo).findByRole('option', { name: seleccion.team })
  elegirTexto(within(grupo).getByLabelText('Team'), seleccion.team)
  if (seleccion.slot !== undefined) {
    elegirTexto(within(grupo).getByLabelText('Slot'), seleccion.slot)
  }
}

describe('Comparar: Aniimo contra Aniimo', () => {
  it('lee las dos fichas en paralelo por el canal correcto y muestra la tabla', async () => {
    let resolverIzquierda: (r: ResultadoFicha) => void = () => undefined
    let resolverDerecha: (r: ResultadoFichaDeAmigo) => void = () => undefined
    const api = await abrirComparar(
      apiBase(
        {
          obtenerFicha: () =>
            new Promise<ResultadoFichaDeAmigo>((resolve) => (resolverDerecha = resolve))
        },
        { obtenerFicha: () => new Promise<ResultadoFicha>((resolve) => (resolverIzquierda = resolve)) }
      )
    )
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 2' })
    await waitFor(() => expect(api.teams.obtenerFicha).toHaveBeenCalledTimes(1))
    expect(api.amigos.obtenerFicha).toHaveBeenCalledTimes(1)
    expect(api.teams.obtenerFicha).toHaveBeenCalledWith({ teamId: MIO.id, slot: 1 })
    expect(api.amigos.obtenerFicha).toHaveBeenCalledWith({
      usuarioId: ID_DE_BRUNO,
      teamId: DE_BRUNO.id,
      slot: 2
    })
    await act(async () => {
      resolverIzquierda({ ok: true, ficha: fichaGuardadaDeReferencia() })
      resolverDerecha({ ok: true, ficha: fichaDeAmigoDePrueba({ nombre: 'Voltix', cp: 3600, slot: 2 }) })
    })
    const tabla = await screen.findByRole('table', { name: 'Comparación de Aniimo' })
    expect(within(tabla).getByRole('columnheader', { name: 'Yo: Irisalis' })).toBeInTheDocument()
    expect(within(tabla).getByRole('columnheader', { name: 'bruno: Voltix' })).toBeInTheDocument()
    const filaCp = within(tabla).getByRole('row', { name: /^CP/ })
    expect(within(filaCp).getByText('3475')).toBeInTheDocument()
    expect(within(filaCp).getByText('3600')).toBeInTheDocument()
    expect(within(filaCp).getByText('+125')).toBeInTheDocument()
    expect(within(filaCp).getByText('Derecha')).toBeInTheDocument()
    expect(within(tabla).getByRole('row', { name: /^Nivel requerido/ })).toBeInTheDocument()
    expect(within(tabla).queryByText(/Notas/)).toBeNull()
  })

  it('propio contra propio tambien se puede comparar', async () => {
    const api = await abrirComparar()
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'Yo', team: 'Principal', slot: 'Slot 2' })
    await screen.findByRole('table', { name: 'Comparación de Aniimo' })
    expect(api.teams.obtenerFicha).toHaveBeenCalledTimes(2)
    expect(api.amigos.obtenerFicha).not.toHaveBeenCalled()
  })

  it('amigo contra amigo usa el canal de amigos en los dos lados', async () => {
    const api = await abrirComparar()
    await elegir('izquierdo', { duenio: 'bruno', team: 'Raid', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 2' })
    await screen.findByRole('table', { name: 'Comparación de Aniimo' })
    expect(api.amigos.obtenerFicha).toHaveBeenCalledTimes(2)
    expect(api.teams.obtenerFicha).not.toHaveBeenCalled()
  })

  it('un slot sin Aniimo avisa y no muestra tabla', async () => {
    await abrirComparar(apiBase({ obtenerFicha: async () => ({ ok: true, ficha: null }) }))
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 3' })
    expect(await screen.findByText('El slot elegido no tiene un Aniimo')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Comparar: team contra team', () => {
  it('sin slot en ninguno de los lados muestra los cuatro pares', async () => {
    const api = await abrirComparar()
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid' })
    const tabla = await screen.findByRole('table', { name: 'Comparación de teams' })
    const filas = within(tabla).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(4)
    expect(within(filas[0] as HTMLElement).getByText(/Irisalis/)).toBeInTheDocument()
    expect(within(filas[0] as HTMLElement).getByText(/Voltix/)).toBeInTheDocument()
    expect(within(filas[1] as HTMLElement).getAllByText('Vacío')).toHaveLength(1)
    expect(within(filas[2] as HTMLElement).getAllByText('Vacío')).toHaveLength(2)
    expect(api.teams.obtenerFicha).not.toHaveBeenCalled()
  })

  it('el resumen incluye nivel, CP, estrella y despertar', async () => {
    await abrirComparar()
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid' })
    const tabla = await screen.findByRole('table', { name: 'Comparación de teams' })
    const fila = within(tabla).getAllByRole('row')[1] as HTMLElement
    const [izquierda] = within(fila).getAllByRole('cell')
    expect(izquierda?.textContent).toBe(
      'Irisalis · Nivel 60 · CP 3475 · Estrella 2 · Despertar 28/43'
    )
  })
})

describe('Comparar: seleccion', () => {
  it('para un amigo ofrece solo los teams de su listado y para Yo incluye los ocultos', async () => {
    await abrirComparar()
    const izquierdo = lado('izquierdo')
    elegirTexto(within(izquierdo).getByLabelText('Dueño'), 'Yo')
    await within(izquierdo).findByRole('option', { name: 'Reservado' })
    expect(within(izquierdo).getByRole('option', { name: 'Principal' })).toBeInTheDocument()
    const derecho = lado('derecho')
    elegirTexto(within(derecho).getByLabelText('Dueño'), 'bruno')
    await within(derecho).findByRole('option', { name: 'Raid' })
    expect(within(derecho).queryByRole('option', { name: 'Reservado' })).toBeNull()
    expect(within(derecho).queryByRole('option', { name: 'Secreto' })).toBeNull()
  })

  it('los duenios ofrecidos son Yo y los amigos aceptados', async () => {
    await abrirComparar()
    const opciones = within(within(lado('izquierdo')).getByLabelText('Dueño')).getAllByRole('option')
    expect(opciones.map((o) => o.textContent)).toEqual(['Sin elegir', 'Yo', 'bruno'])
  })

  it('con slot en un lado y sin slot en el otro no lee nada y pide completar', async () => {
    const api = await abrirComparar()
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid' })
    expect(
      screen.getByText('Completá la selección de los dos lados para comparar')
    ).toBeInTheDocument()
    expect(api.teams.obtenerFicha).not.toHaveBeenCalled()
    expect(api.amigos.obtenerFicha).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('al cambiar de duenio se limpia el team elegido', async () => {
    await abrirComparar()
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal' })
    elegirTexto(within(lado('izquierdo')).getByLabelText('Dueño'), 'bruno')
    await within(lado('izquierdo')).findByRole('option', { name: 'Raid' })
    expect((within(lado('izquierdo')).getByLabelText('Team') as HTMLSelectElement).value).toBe('')
  })

  it('no usa atributos style', async () => {
    await abrirComparar()
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 2' })
    await screen.findByRole('table')
    expect(document.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('Comparar: estado de amigos, acceso y sesion', () => {
  it('cargar una comparacion refresca el estado de amigos', async () => {
    const api = await abrirComparar()
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalled())
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 2' })
    await screen.findByRole('table')
    const antes = api.amigos.listar.mock.calls.length
    elegirTexto(within(lado('derecho')).getByLabelText('Slot'), 'Slot 1')
    await waitFor(() => expect(api.amigos.listar.mock.calls.length).toBeGreaterThan(antes))
  })

  it('no-encontrado en el lado derecho avisa y limpia ese lado', async () => {
    await abrirComparar(
      apiBase({ obtenerFicha: async () => ({ ok: false, error: 'no-encontrado' }) })
    )
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 2' })
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect((within(lado('derecho')).getByLabelText('Dueño') as HTMLSelectElement).value).toBe('')
    expect((within(lado('izquierdo')).getByLabelText('Dueño') as HTMLSelectElement).value).not.toBe('')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('un team del amigo ocultado despues de elegirlo limpia el lado al comparar teams', async () => {
    const api = await abrirComparar()
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid' })
    await screen.findByRole('table', { name: 'Comparación de teams' })
    api.amigos.listarTeams.mockResolvedValue({
      ok: true,
      usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' },
      teams: []
    })
    elegirTexto(within(lado('izquierdo')).getByLabelText('Team'), 'Reservado')
    elegirTexto(within(lado('izquierdo')).getByLabelText('Team'), 'Principal')
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect((within(lado('derecho')).getByLabelText('Dueño') as HTMLSelectElement).value).toBe('')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('no-encontrado de la ficha por un team ocultado limpia el lado', async () => {
    await abrirComparar(
      apiBase({
        obtenerFicha: async () => ({ ok: false, error: 'no-encontrado' })
      })
    )
    await elegir('izquierdo', { duenio: 'bruno', team: 'Raid', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect((within(lado('izquierdo')).getByLabelText('Dueño') as HTMLSelectElement).value).toBe('')
  })

  it('sesion-vencida en una lectura vuelve al login', async () => {
    await abrirComparar(
      apiBase({ obtenerFicha: async () => ({ ok: false, error: 'sesion-vencida' }) })
    )
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 2' })
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it('otro error de lectura se muestra sin tabla', async () => {
    await abrirComparar(apiBase({ obtenerFicha: async () => ({ ok: false, error: 'sin-conexion' }) }))
    await elegir('izquierdo', { duenio: 'Yo', team: 'Principal', slot: 'Slot 1' })
    await elegir('derecho', { duenio: 'bruno', team: 'Raid', slot: 'Slot 2' })
    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Comparar: llegada desde la ficha de un amigo', () => {
  it('abre Comparar con el Aniimo del amigo ya elegido a la derecha', async () => {
    const api = instalarApi(
      apiBase({
        obtenerFicha: async () => ({
          ok: true,
          ficha: fichaDeAmigoDePrueba({ nombre: 'Voltix', slot: 1 })
        })
      })
    )
    render(<App />)
    await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
    navegar('Amigos')
    fireEvent.click(await screen.findByRole('button', { name: 'Ver teams' }))
    fireEvent.click((await screen.findAllByRole('button', { name: /Voltix/ }))[0] as HTMLElement)
    await screen.findByRole('heading', { name: /Ficha de solo lectura/ })
    const botones = screen.getAllByRole('button', { name: 'Comparar' })
    fireEvent.click(botones[botones.length - 1] as HTMLElement)
    await screen.findByRole('heading', { level: 2, name: 'Comparar' })
    const derecho = lado('derecho')
    await waitFor(() =>
      expect((within(derecho).getByLabelText('Dueño') as HTMLSelectElement).selectedOptions[0]?.textContent).toBe('bruno')
    )
    await waitFor(() =>
      expect((within(derecho).getByLabelText('Team') as HTMLSelectElement).selectedOptions[0]?.textContent).toBe('Raid')
    )
    expect((within(derecho).getByLabelText('Slot') as HTMLSelectElement).selectedOptions[0]?.textContent).toBe('Slot 1')
    expect((within(lado('izquierdo')).getByLabelText('Dueño') as HTMLSelectElement).value).toBe('')
    expect(api.teams.obtenerFicha).not.toHaveBeenCalled()
  })
})
