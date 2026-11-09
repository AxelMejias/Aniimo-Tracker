// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  armarGrupoDeAmigo,
  BRUNO,
  fichaDeAmigoDePrueba,
  ID_DE_BRUNO,
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDeAmigoDePrueba,
  type ApiFalsa
} from '../../../../../tests/fixtures/apiFalsa'
import type { AmigosApi } from '../../../../preload/api'
import type { FichaDeAmigo, GrupoDeAmigo, TeamDeAmigo } from '../../../../shared/teams'
import App from '../../App'

afterEach(cleanup)

const TEAM = teamDeAmigoDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })

function amigosConTeams(
  teams: readonly TeamDeAmigo[] = [TEAM],
  ficha: FichaDeAmigo | null = fichaDeAmigoDePrueba(),
  grupos: readonly GrupoDeAmigo[] = []
): { amigos: Partial<AmigosApi> } {
  return {
    amigos: {
      listar: async () => ({ ok: true, amigos: [BRUNO], recibidas: [], enviadas: [] }),
      listarTeams: async () => ({
        ok: true,
        usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' },
        teams,
        grupos
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
  await screen.findByRole('heading', { level: 2, name: 'Teams de bruno' })
  return api
}

async function abrirTeamPrincipal(
  sobrescribir?: Parameters<typeof instalarApi>[0]
): Promise<ApiFalsa> {
  const api = await verTeamsDeBruno(sobrescribir)
  fireEvent.click(await screen.findByRole('button', { name: /^Team Principal/ }))
  await screen.findByRole('heading', { level: 2, name: 'Principal' })
  return api
}

async function abrirIrisalis(sobrescribir?: Parameters<typeof instalarApi>[0]): Promise<ApiFalsa> {
  const api = await abrirTeamPrincipal(sobrescribir)
  fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
  await screen.findByRole('heading', { name: /Ficha de solo lectura/ })
  return api
}

function panel(nombre: string): HTMLElement {
  const encontrado = document.querySelector<HTMLElement>(`[data-pestana="${nombre.toLowerCase()}"]`)
  if (encontrado === null) {
    throw new Error(`no hay panel ${nombre}`)
  }
  return encontrado
}

describe('teams de un amigo', () => {
  it('muestra el rotulo Solo lectura, el titulo y la pila del team suelto con 1/4', async () => {
    await verTeamsDeBruno()
    expect(screen.getByText('Solo lectura')).toBeInTheDocument()
    const sueltos = await screen.findByRole('region', { name: 'Teams sueltos' })
    const pila = within(sueltos).getByRole('button', { name: /^Team Principal/ })
    expect(within(pila).getByText('1/4')).toBeInTheDocument()
    expect(within(pila).getByText('Irisalis')).toBeInTheDocument()
  })

  it('no ofrece crear, organizar, agrupar, portada ni selectores', async () => {
    await verTeamsDeBruno()
    await screen.findByRole('region', { name: 'Teams sueltos' })
    for (const nombre of [
      'Nuevo team',
      'Nuevo grupo',
      'Organizar',
      'Agrupar',
      'Elegir portada',
      'Renombrar'
    ]) {
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
    }
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('Oculto para amigos')).toBeNull()
    expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(0)
  })

  it('pide los teams del amigo y refresca el estado de amigos', async () => {
    const api = await verTeamsDeBruno()
    await screen.findByRole('region', { name: 'Teams sueltos' })
    expect(api.amigos.listarTeams).toHaveBeenCalledWith({ usuarioId: ID_DE_BRUNO })
    await waitFor(() => expect(api.amigos.listar.mock.calls.length).toBeGreaterThanOrEqual(3))
  })

  it('la imagen de la pila se carga por el canal de amigos y no por el propio', async () => {
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
    await waitFor(() => expect(document.querySelector('img.carta__imagen')).not.toBeNull())
  })

  it('un amigo sin teams visibles muestra un texto', async () => {
    await verTeamsDeBruno(amigosConTeams([]))
    expect(await screen.findByText('bruno todavía no tiene teams para mostrar')).toBeInTheDocument()
  })

  it('no-encontrado al listar muestra el aviso y vuelve a Amigos', async () => {
    const base = amigosConTeams()
    instalarApi({
      amigos: { ...base.amigos, listarTeams: async () => ({ ok: false, error: 'no-encontrado' }) }
    })
    render(<App />)
    await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', {
        name: 'Amigos'
      })
    )
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver teams' }))[0] as HTMLElement)
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('sesion-vencida al listar vuelve al login', async () => {
    const base = amigosConTeams()
    instalarApi({
      amigos: { ...base.amigos, listarTeams: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    render(<App />)
    await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', {
        name: 'Amigos'
      })
    )
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver teams' }))[0] as HTMLElement)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it('otro error al listar muestra el mensaje y permite volver', async () => {
    const base = amigosConTeams()
    instalarApi({
      amigos: { ...base.amigos, listarTeams: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    render(<App />)
    await screen.findByRole('heading', { level: 2, name: 'Mis teams' })
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Secciones' })).getByRole('button', {
        name: 'Amigos'
      })
    )
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver teams' }))[0] as HTMLElement)
    expect(
      await screen.findByText(
        'No se pudo conectar con el servidor. Revisá que el backend esté levantado.'
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Amigos' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('Volver a Amigos regresa a la pantalla Amigos', async () => {
    await verTeamsDeBruno()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Amigos' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })
})

describe('grupos de un amigo', () => {
  const A = teamDeAmigoDePrueba('A', 1)
  const B = teamDeAmigoDePrueba('B', 2)
  const C = teamDeAmigoDePrueba('C', 3)
  const D = teamDeAmigoDePrueba('D', 4)

  function conGrupoCompetitivo(portada: string | null = B.id) {
    const competitivo = armarGrupoDeAmigo('Competitivo', 1, [A, B, C], portada)
    return amigosConTeams([...competitivo.teams, D], fichaDeAmigoDePrueba(), [competitivo.grupo])
  }

  function botonDelGrupo(): HTMLElement {
    const grupo = screen.getByRole('region', { name: 'Grupo Competitivo' })
    return within(grupo).getByRole('button', { name: /^Competitivo / })
  }

  it('muestra el grupo con la cantidad de teams, la pila de portada y D en Teams sueltos', async () => {
    await verTeamsDeBruno(conGrupoCompetitivo())
    const grupo = await screen.findByRole('region', { name: 'Grupo Competitivo' })
    expect(within(grupo).getByText(/3 teams/)).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: /^Team B/ })).toBeInTheDocument()
    expect(within(grupo).queryByRole('button', { name: /^Team A/ })).toBeNull()
    const sueltos = screen.getByRole('region', { name: 'Teams sueltos' })
    expect(within(sueltos).getByRole('button', { name: /^Team D/ })).toBeInTheDocument()
  })

  it('al desplegar numera los teams en orden del grupo', async () => {
    await verTeamsDeBruno(conGrupoCompetitivo())
    await screen.findByRole('region', { name: 'Grupo Competitivo' })
    fireEvent.click(botonDelGrupo())
    const grupo = screen.getByRole('region', { name: 'Grupo Competitivo' })
    expect(botonDelGrupo()).toHaveAttribute('aria-expanded', 'true')
    expect(within(grupo).getByRole('button', { name: /^1: Team A/ })).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: /^2: Team B/ })).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: /^3: Team C/ })).toBeInTheDocument()
  })

  it('no ofrece selectores, subir, bajar ni arrastre', async () => {
    await verTeamsDeBruno(conGrupoCompetitivo())
    await screen.findByRole('region', { name: 'Grupo Competitivo' })
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Subir|Bajar|Borrar grupo|Nuevo grupo/ })).toBeNull()
    expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(0)
  })

  it('T con el foco en el grupo lo despliega, 2 abre el segundo team y Esc pliega', async () => {
    await verTeamsDeBruno(conGrupoCompetitivo())
    await screen.findByRole('region', { name: 'Grupo Competitivo' })
    botonDelGrupo().focus()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 't' })
    expect(botonDelGrupo()).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(botonDelGrupo()).toHaveAttribute('aria-expanded', 'false')
    expect(botonDelGrupo()).toHaveFocus()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 't' })
    fireEvent.keyDown(document.activeElement ?? document.body, { key: '2' })
    expect(await screen.findByRole('heading', { level: 2, name: 'B' })).toBeInTheDocument()
  })

  it('las teclas dejan de actuar al salir de la vista', async () => {
    await verTeamsDeBruno(conGrupoCompetitivo())
    await screen.findByRole('region', { name: 'Grupo Competitivo' })
    fireEvent.click(screen.getByRole('button', { name: 'Volver a Amigos' }))
    await screen.findByRole('heading', { level: 2, name: 'Amigos' })
    fireEvent.keyDown(document.body, { key: 't' })
    expect(screen.queryByRole('button', { name: /^Competitivo / })).toBeNull()
  })
})

describe('team de un amigo en solo lectura', () => {
  it('muestra las migas, la carta de Irisalis con Portada y tres slots Vacio', async () => {
    const conPortada = { ...TEAM, portadaSlot: 1 }
    await abrirTeamPrincipal(amigosConTeams([conPortada]))
    const migas = screen.getByRole('navigation', { name: 'Ubicación' })
    expect(within(migas).getByRole('button', { name: 'Amigos' })).toBeInTheDocument()
    expect(within(migas).getByRole('button', { name: 'bruno' })).toBeInTheDocument()
    expect(within(migas).getByText('Principal')).toHaveAttribute('aria-current', 'page')
    const carta = screen.getByRole('button', { name: /Irisalis/ })
    expect(within(carta).getByText('Portada')).toBeInTheDocument()
    expect(screen.getAllByText('Vacío')).toHaveLength(3)
  })

  it('no ofrece acciones de edicion ni overlay ni visibilidad', async () => {
    await abrirTeamPrincipal()
    for (const nombre of [
      'Agregar Aniimo',
      'Renombrar',
      'Borrar team',
      'Elegir portada',
      'Abrir en overlay',
      'Sacar del grupo',
      'Agrupar'
    ]) {
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
    }
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('Oculto para amigos')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(document.querySelectorAll('[style]')).toHaveLength(0)
  })

  it('los slots vacios no son botones', async () => {
    await abrirTeamPrincipal()
    for (const vacio of screen.getAllByText('Vacío')) {
      expect(vacio.closest('button')).toBeNull()
    }
  })

  it('sin portada recibida la carta no lleva la marca', async () => {
    await abrirTeamPrincipal()
    const carta = screen.getByRole('button', { name: /Irisalis/ })
    expect(within(carta).queryByText('Portada')).toBeNull()
  })

  it('las migas de un team con grupo incluyen el grupo', async () => {
    const competitivo = armarGrupoDeAmigo('Competitivo', 1, [TEAM], TEAM.id)
    await abrirTeamPrincipal(
      amigosConTeams([...competitivo.teams], fichaDeAmigoDePrueba(), [competitivo.grupo])
    )
    const migas = screen.getByRole('navigation', { name: 'Ubicación' })
    expect(within(migas).getByRole('button', { name: 'Competitivo' })).toBeInTheDocument()
  })

  it('las migas llevan a Amigos y a los teams del amigo', async () => {
    await abrirTeamPrincipal()
    const migas = screen.getByRole('navigation', { name: 'Ubicación' })
    fireEvent.click(within(migas).getByRole('button', { name: 'bruno' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Teams de bruno' })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /^Team Principal/ }))
    await screen.findByRole('heading', { level: 2, name: 'Principal' })
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Ubicación' })).getByRole('button', {
        name: 'Amigos'
      })
    )
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('la miga de un grupo vuelve a los teams del amigo con ese grupo desplegado', async () => {
    const A = teamDeAmigoDePrueba('A', 5)
    const competitivo = armarGrupoDeAmigo('Competitivo', 1, [A, TEAM], A.id)
    await verTeamsDeBruno(
      amigosConTeams([...competitivo.teams], fichaDeAmigoDePrueba(), [competitivo.grupo])
    )
    fireEvent.click(
      within(await screen.findByRole('region', { name: 'Grupo Competitivo' })).getByRole('button', {
        name: /^Competitivo /
      })
    )
    fireEvent.click(await screen.findByRole('button', { name: /^2: Team Principal/ }))
    await screen.findByRole('heading', { level: 2, name: 'Principal' })
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Ubicación' })).getByRole('button', {
        name: 'Competitivo'
      })
    )
    await screen.findByRole('heading', { level: 2, name: 'Teams de bruno' })
    expect(
      within(screen.getByRole('region', { name: 'Grupo Competitivo' })).getByRole('button', {
        name: /^Competitivo /
      })
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('no-encontrado al abrir el team muestra el aviso y vuelve a Amigos', async () => {
    const base = amigosConTeams()
    let llamadas = 0
    await verTeamsDeBruno({
      amigos: {
        ...base.amigos,
        listarTeams: async () => {
          llamadas += 1
          return llamadas === 1
            ? { ok: true, usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' }, teams: [TEAM], grupos: [] }
            : { ok: false, error: 'no-encontrado' }
        }
      }
    })
    fireEvent.click(await screen.findByRole('button', { name: /^Team Principal/ }))
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('sesion-vencida al abrir el team vuelve al login', async () => {
    const base = amigosConTeams()
    let llamadas = 0
    await verTeamsDeBruno({
      amigos: {
        ...base.amigos,
        listarTeams: async () => {
          llamadas += 1
          return llamadas === 1
            ? { ok: true, usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' }, teams: [TEAM], grupos: [] }
            : { ok: false, error: 'sesion-vencida' }
        }
      }
    })
    fireEvent.click(await screen.findByRole('button', { name: /^Team Principal/ }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
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

  it('organiza los datos en pestanas sin Potencial', async () => {
    await abrirIrisalis()
    const lista = screen.getByRole('tablist', { name: 'Bloques de la ficha' })
    expect(within(lista).getAllByRole('tab').map((p) => p.textContent)).toEqual([
      'Generales',
      'Stats',
      'Entrenamiento',
      'Objetos',
      'Notas'
    ])
    expect(screen.getByRole('tab', { name: 'Generales' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Stats' }))
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Stats')
  })

  it('muestra datos generales, stats, entrenamiento, objetos y notas en sus pestanas', async () => {
    await abrirIrisalis()
    expect(
      screen.getByRole('heading', { name: 'Ficha de solo lectura: Irisalis (slot 1)' })
    ).toBeInTheDocument()
    for (const texto of ['Irisalis', 'Hielo', 'Curación', 'Perfecto', 'ENFJ', '60', '3475']) {
      expect(within(panel('Generales')).getAllByText(texto).length).toBeGreaterThan(0)
    }
    const stats = panel('Stats')
    expect(within(stats).getByText('ATQ')).toBeInTheDocument()
    expect(within(stats).getByText('Tope de potencial')).toBeInTheDocument()
    expect(within(stats).getByText('11321')).toBeInTheDocument()
    expect(within(panel('Entrenamiento')).getByText('28/43')).toBeInTheDocument()
    expect(within(panel('Entrenamiento')).getByText('Polvo estelar')).toBeInTheDocument()
    expect(within(panel('Objetos')).getByText('Corona antigua')).toBeInTheDocument()
    expect(within(panel('Objetos')).getByText('Efecto de nucleo de prueba')).toBeInTheDocument()
    expect(within(panel('Notas')).getByText('Aniimo de referencia')).toBeInTheDocument()
    expect(within(panel('Notas')).getByText(/ataque electrico/)).toBeInTheDocument()
  })

  it('la carta grande muestra las barras de potencial con su numero', async () => {
    await abrirIrisalis()
    const lista = screen.getByRole('list', { name: 'Potencial por stat' })
    const atq = within(lista)
      .getAllByRole('listitem')
      .find((li) => li.querySelector('.carta-ficha__stat')?.textContent === 'ATQ')
    expect(atq?.querySelector('rect.barra__relleno')?.getAttribute('width')).toBe('100')
    expect(atq).toHaveTextContent('20')
  })

  it('no tiene campos editables ni botones de guardar o borrar', async () => {
    await abrirIrisalis()
    expect(document.querySelectorAll('input, select, textarea')).toHaveLength(0)
    for (const nombre of ['Guardar', 'Borrar', 'Cancelar', 'Quitar imagen']) {
      expect(screen.queryByRole('button', { name: nombre })).toBeNull()
    }
    expect(screen.getAllByRole('button', { name: 'Comparar' })).toHaveLength(2)
    for (const pestana of ['Generales', 'Stats', 'Entrenamiento', 'Objetos', 'Notas']) {
      fireEvent.click(screen.getByRole('tab', { name: pestana }))
      expect(document.querySelectorAll('[style]')).toHaveLength(0)
    }
  })

  it('no ofrece la sugerencia de stats ni pide el catalogo de calculo', async () => {
    const api = await abrirIrisalis()
    expect(screen.queryByText('Sugerencia de stats')).toBeNull()
    expect(api.calculo.obtenerCatalogo).not.toHaveBeenCalled()
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
    expect(within(panel('Notas')).getAllByText('Sin notas')).toHaveLength(2)
    expect(within(panel('Stats')).getAllByText('Sin notas')).toHaveLength(6)
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

  it('Volver regresa a la pantalla del team del amigo', async () => {
    await abrirIrisalis()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Principal' })).toBeInTheDocument()
  })

  it('Comparar abre Comparar con ese Aniimo a la derecha', async () => {
    await abrirIrisalis()
    const botones = screen.getAllByRole('button', { name: 'Comparar' })
    fireEvent.click(botones[botones.length - 1] as HTMLElement)
    await screen.findByRole('heading', { level: 2, name: 'Comparar' })
    const derecho = screen.getByRole('group', { name: 'Lado derecho' })
    await waitFor(() =>
      expect(
        (within(derecho).getByLabelText('Dueño') as HTMLSelectElement).selectedOptions[0]?.textContent
      ).toBe('bruno')
    )
  })

  it('no-encontrado al leer la ficha muestra el aviso y vuelve a Amigos', async () => {
    const base = amigosConTeams()
    await abrirTeamPrincipal({
      amigos: { ...base.amigos, obtenerFicha: async () => ({ ok: false, error: 'no-encontrado' }) }
    })
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText('Ya no tenés acceso a esos datos')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Amigos' })).toBeInTheDocument()
  })

  it('sesion-vencida al leer la ficha vuelve al login', async () => {
    const base = amigosConTeams()
    await abrirTeamPrincipal({
      amigos: { ...base.amigos, obtenerFicha: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
  })

  it('un slot que ya no tiene Aniimo muestra el aviso y permite volver', async () => {
    await abrirTeamPrincipal(amigosConTeams([TEAM], null))
    fireEvent.click(await screen.findByRole('button', { name: /Irisalis/ }))
    expect(await screen.findByText('Este slot ya no tiene un Aniimo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  })
})

describe('refresco al abrir fichas de amigos', () => {
  it('abrir y cerrar la ficha de un amigo refresca el estado de amigos', async () => {
    const api = await abrirTeamPrincipal()
    const boton = await screen.findByRole('button', { name: /Irisalis/ })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalled())
    api.amigos.listar.mockClear()
    fireEvent.click(boton)
    await screen.findByRole('heading', { name: /Ficha de solo lectura/ })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    await screen.findByRole('heading', { level: 2, name: 'Principal' })
    await waitFor(() => expect(api.amigos.listar).toHaveBeenCalledTimes(2))
  })
})
