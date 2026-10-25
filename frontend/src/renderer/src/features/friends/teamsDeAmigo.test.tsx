// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BRUNO,
  fichaDeAmigoDePrueba,
  ID_DE_BRUNO,
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDeAmigoDePrueba,
  type ApiFalsa
} from '../../../../../tests/fixtures/apiFalsa'
import type { AmigosApi } from '../../../../preload/api'
import type { FichaDeAmigo } from '../../../../shared/teams'
import App from '../../App'

afterEach(cleanup)

const TEAM = teamDeAmigoDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })

function amigosConTeams(
  teams = [TEAM],
  ficha: FichaDeAmigo | null = fichaDeAmigoDePrueba()
): { amigos: Partial<AmigosApi> } {
  return {
    amigos: {
      listar: async () => ({ ok: true, amigos: [BRUNO], recibidas: [], enviadas: [] }),
      listarTeams: async () => ({
        ok: true,
        usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' },
        teams
      }),
      obtenerFicha: async () => ({ ok: true, ficha })
    }
  }
}

async function verTeamsDeBruno(
  sobrescribir: Parameters<typeof instalarApi>[0] = amigosConTeams()
): Promise<ApiFalsa> {
  const api = instalarApi(sobrescribir)
  render(<App />)
  await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
  fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', {
      name: 'Amigos'
    })
  )
  const botones = await screen.findAllByRole('button', { name: 'Ver teams' })
  fireEvent.click(botones[0] as HTMLElement)
  return api
}

async function abrirIrisalis(sobrescribir?: Parameters<typeof instalarApi>[0]): Promise<ApiFalsa> {
  const api = await verTeamsDeBruno(sobrescribir)
  fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
  await screen.findByRole('heading', { name: /Ficha de solo lectura/ })
  return api
}

describe('teams de un amigo', () => {
  it('muestra el nombre del amigo, el team y la tarjeta de Irisalis con tres slots vacios', async () => {
    await verTeamsDeBruno()
    expect(await screen.findByRole('heading', { level: 2, name: 'Teams de bruno' })).toBeInTheDocument()
    const team = within(screen.getByRole('heading', { name: 'Principal' }).closest('section')!)
    expect(team.getByText('Irisalis')).toBeInTheDocument()
    expect(team.getByText('Nivel 60')).toBeInTheDocument()
    expect(team.getByText('CP 3475')).toBeInTheDocument()
    expect(team.getByText('Despertar 28/43')).toBeInTheDocument()
    expect(team.getAllByText('Vacío')).toHaveLength(3)
  })

  it('no ofrece renombrar, borrar, crear team, agregar Aniimo ni la casilla de visibilidad', async () => {
    await verTeamsDeBruno()
    await screen.findByRole('heading', { name: 'Principal' })
    for (const nombre of ['Renombrar', 'Borrar team', 'Crear team', 'Agregar Aniimo']) {
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
    }
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('Oculto para amigos')).toBeNull()
  })

  it('no ofrece abrir en overlay', async () => {
    await verTeamsDeBruno()
    await screen.findByRole('heading', { name: 'Principal' })
    expect(screen.queryByRole('button', { name: 'Abrir en overlay' })).toBeNull()
  })

  it('los slots vacios no son botones', async () => {
    await verTeamsDeBruno()
    await screen.findByRole('heading', { name: 'Principal' })
    const vacios = screen.getAllByText('Vacío')
    for (const vacio of vacios) {
      expect(vacio.closest('button')).toBeNull()
    }
  })

  it('pide los teams del amigo y refresca el estado de amigos', async () => {
    const api = await verTeamsDeBruno()
    await screen.findByRole('heading', { name: 'Principal' })
    expect(api.amigos.listarTeams).toHaveBeenCalledWith({ usuarioId: ID_DE_BRUNO })
    await waitFor(() => expect(api.amigos.listar.mock.calls.length).toBeGreaterThanOrEqual(3))
  })

  it('la imagen se carga por el canal de amigos y no por el propio', async () => {
    const equipo = teamDeAmigoDePrueba('Principal', 1, {
      1: { ...RESUMEN_DE_IRISALIS, tieneImagen: true }
    })
    const sobrescribir = amigosConTeams([equipo])
    const api = await verTeamsDeBruno({
      amigos: {
        ...sobrescribir.amigos,
        obtenerImagen: async () => ({ ok: true, imagen: 'data:image/webp;base64,AQID' })
      }
    })
    await waitFor(() =>
      expect(api.amigos.obtenerImagen).toHaveBeenCalledWith({
        usuarioId: ID_DE_BRUNO,
        teamId: equipo.id,
        slot: 1
      })
    )
    expect(api.teams.obtenerImagen).not.toHaveBeenCalled()
    await waitFor(() => expect(document.querySelector('img.tarjeta-aniimo__imagen')).not.toBeNull())
  })

  it('un amigo sin teams visibles muestra un texto', async () => {
    await verTeamsDeBruno(amigosConTeams([]))
    expect(await screen.findByText('bruno todavía no tiene teams para mostrar')).toBeInTheDocument()
  })

  it('no-encontrado al listar muestra el aviso y vuelve a Amigos', async () => {
    const base = amigosConTeams()
    await verTeamsDeBruno({
      amigos: { ...base.amigos, listarTeams: async () => ({ ok: false, error: 'no-encontrado' }) }
    })
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('sesion-vencida al listar vuelve al login', async () => {
    const base = amigosConTeams()
    await verTeamsDeBruno({
      amigos: { ...base.amigos, listarTeams: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it('otro error al listar muestra el mensaje y permite volver', async () => {
    const base = amigosConTeams()
    await verTeamsDeBruno({
      amigos: { ...base.amigos, listarTeams: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Amigos' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('Volver a Amigos regresa a la pantalla Amigos', async () => {
    await verTeamsDeBruno()
    await screen.findByRole('heading', { name: 'Principal' })
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Amigos' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })
})

describe('ficha de un amigo en solo lectura', () => {
  it('pide la ficha con usuario, team y slot', async () => {
    const api = await abrirIrisalis()
    expect(api.amigos.obtenerFicha).toHaveBeenCalledWith({
      usuarioId: ID_DE_BRUNO,
      teamId: TEAM.id,
      slot: 1
    })
    expect(api.teams.obtenerFicha).not.toHaveBeenCalled()
  })

  it('muestra datos generales, stats, entrenamiento, objetos y notas', async () => {
    await abrirIrisalis()
    expect(screen.getByRole('heading', { name: 'Ficha de solo lectura: Irisalis (slot 1)' })).toBeInTheDocument()
    const general = screen.getByRole('group', { name: 'Datos generales' })
    for (const texto of ['Irisalis', 'Hielo', 'Curación', 'Perfecto', 'ENFJ', '60', '3475']) {
      expect(within(general).getByText(texto)).toBeInTheDocument()
    }
    const stats = screen.getByRole('group', { name: 'Stats' })
    expect(within(stats).getByText('ATQ')).toBeInTheDocument()
    expect(within(stats).getByText('Tope de potencial')).toBeInTheDocument()
    expect(within(stats).getByText('11321')).toBeInTheDocument()
    const entrenamiento = screen.getByRole('group', { name: 'Entrenamiento' })
    expect(within(entrenamiento).getByText('28/43')).toBeInTheDocument()
    expect(within(entrenamiento).getByText('Polvo estelar')).toBeInTheDocument()
    const objetos = screen.getByRole('group', { name: 'Objetos transportados' })
    expect(within(objetos).getByText('Corona antigua')).toBeInTheDocument()
    expect(within(objetos).getByText('Efecto de nucleo de prueba')).toBeInTheDocument()
    const notas = screen.getByRole('group', { name: 'Habilidades y notas' })
    expect(within(notas).getByText('Aniimo de referencia')).toBeInTheDocument()
    expect(within(notas).getByText(/ataque electrico/)).toBeInTheDocument()
  })

  it('no tiene campos editables ni botones de guardar o borrar', async () => {
    await abrirIrisalis()
    expect(document.querySelectorAll('input, select, textarea')).toHaveLength(0)
    for (const nombre of ['Guardar', 'Borrar', 'Cancelar', 'Quitar imagen']) {
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
    }
    expect(screen.getAllByRole('button', { name: 'Comparar' })).toHaveLength(2)
    expect(document.querySelectorAll('[style]')).toHaveLength(0)
  })

  it('las notas en null se muestran como Sin notas sin mencionar notas privadas', async () => {
    const base = fichaDeAmigoDePrueba()
    const sinNotas = fichaDeAmigoDePrueba({
      notas: null,
      notasHabilidades: null,
      stats: Object.fromEntries(
        Object.entries(base.stats).map(([codigo, stat]) => [codigo, { ...stat, notas: null }])
      ) as FichaDeAmigo['stats'],
      objetos: base.objetos.map((o) => ({ ...o, efectoNucleoNotas: null }))
    })
    await abrirIrisalis(amigosConTeams([TEAM], sinNotas))
    const notas = screen.getByRole('group', { name: 'Habilidades y notas' })
    expect(within(notas).getAllByText('Sin notas')).toHaveLength(2)
    expect(within(screen.getByRole('group', { name: 'Stats' })).getAllByText('Sin notas')).toHaveLength(6)
    expect(document.body.textContent).not.toMatch(/privad/i)
  })

  it('carga la imagen por el canal de amigos', async () => {
    const base = amigosConTeams([TEAM], fichaDeAmigoDePrueba({ tieneImagen: true }))
    const api = await abrirIrisalis({
      amigos: {
        ...base.amigos,
        obtenerImagen: async () => ({ ok: true, imagen: 'data:image/webp;base64,AQID' })
      }
    })
    await waitFor(() =>
      expect(api.amigos.obtenerImagen).toHaveBeenCalledWith({
        usuarioId: ID_DE_BRUNO,
        teamId: TEAM.id,
        slot: 1
      })
    )
    await waitFor(() => expect(screen.getByAltText('Imagen del Aniimo')).toBeInTheDocument())
  })

  it('Volver regresa a los teams del amigo', async () => {
    await abrirIrisalis()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Teams de bruno' })).toBeInTheDocument()
  })

  it('no-encontrado al leer la ficha muestra el aviso y vuelve a Amigos', async () => {
    const base = amigosConTeams()
    await verTeamsDeBruno({
      amigos: { ...base.amigos, obtenerFicha: async () => ({ ok: false, error: 'no-encontrado' }) }
    })
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('sesion-vencida al leer la ficha vuelve al login', async () => {
    const base = amigosConTeams()
    await verTeamsDeBruno({
      amigos: { ...base.amigos, obtenerFicha: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
  })

  it('un slot que ya no tiene Aniimo muestra el aviso y permite volver', async () => {
    await verTeamsDeBruno(amigosConTeams([TEAM], null))
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText('Este slot ya no tiene un Aniimo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  })
})

describe('refresco al abrir fichas de amigos', () => {
  it('abrir y cerrar la ficha de un amigo refresca el estado de amigos', async () => {
    const api = await verTeamsDeBruno()
    const boton = await screen.findByRole('button', { name: /Irisalis/ })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalled())
    api.amigos.listar.mockClear()
    fireEvent.click(boton)
    await screen.findByRole('heading', { name: /Ficha de solo lectura/ })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    await screen.findByRole('heading', { level: 2, name: 'Teams de bruno' })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(2))
  })
})
