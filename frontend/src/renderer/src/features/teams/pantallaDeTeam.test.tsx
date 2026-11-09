// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  armarGrupo,
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDePrueba
} from '../../../../../tests/fixtures/apiFalsa'
import type { GrupoResumen, TeamResumen } from '../../../../shared/teams'
import App from '../../App'

afterEach(cleanup)

const ORCUS = { ...RESUMEN_DE_IRISALIS, nombre: 'Orcus' }
const DEMO = { ...RESUMEN_DE_IRISALIS, nombre: 'Demoflama' }

const PRINCIPAL = teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS, 2: ORCUS, 3: DEMO })
const JEFES = teamDePrueba('Jefes', 2, {}, true)
const TORRE = teamDePrueba('Torre', 3)
const RAID = teamDePrueba('Raid', 4)
const PVP = teamDePrueba('PvP', 5)
const FARMEO = teamDePrueba('Farmeo', 6)
const CASA = teamDePrueba('Casa', 7)

interface Datos {
  readonly teams: readonly TeamResumen[]
  readonly grupos: readonly GrupoResumen[]
}

function datosBase(): Datos {
  const buildeado = armarGrupo('Buildeado', 1, [PRINCIPAL, JEFES, TORRE, RAID, PVP])
  const homeland = armarGrupo('Homeland', 2, [CASA])
  return {
    teams: [...buildeado.teams, ...homeland.teams, FARMEO],
    grupos: [buildeado.grupo, homeland.grupo]
  }
}

function promesaManual() {
  let resolver: (valor: unknown) => void = () => undefined
  const promesa = new Promise<never>((resolve) => {
    resolver = (valor) => resolve(valor as never)
  })
  return { promesa, resolver: (valor: unknown) => resolver(valor) }
}

async function verMisTeams(): Promise<void> {
  await screen.findByRole('heading', { name: 'Mis teams' })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
}

async function montar(datos: Datos = datosBase(), extra: Parameters<typeof instalarApi>[0] = {}) {
  const api = instalarApi({
    ...extra,
    teams: { listar: async () => ({ ok: true, ...datos }), ...extra.teams }
  })
  render(<App />)
  await verMisTeams()
  return api
}

async function abrirTeam(nombre: string, grupo?: string): Promise<void> {
  if (grupo !== undefined) {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${grupo} `) }))
  }
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^(\\d: )?Team ${nombre}, `) }))
  await screen.findByRole('heading', { level: 2, name: nombre })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
}

async function montarYAbrir(nombre: string, datos: Datos = datosBase(), extra = {}, grupo?: string) {
  const api = await montar(datos, extra)
  await abrirTeam(nombre, grupo)
  return api
}

function cartasDelTeam(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /Nv \d+|Agregar Aniimo/ })
}

describe('pantalla de un team', () => {
  it('un team de un grupo muestra migas, posicion, portada, cantidad, cartas y botones del grupo', async () => {
    await montarYAbrir('Principal')
    const migas = screen.getByRole('navigation', { name: 'Ubicación' })
    expect(within(migas).getByRole('button', { name: 'Mis teams' })).toBeInTheDocument()
    expect(within(migas).getByRole('button', { name: 'Buildeado' })).toBeInTheDocument()
    expect(within(migas).getByText('Principal')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Team 1 de 5 en «Buildeado»')).toBeInTheDocument()
    expect(screen.getByText('portada del grupo')).toBeInTheDocument()
    expect(screen.getByText('3/4 Aniimo')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getAllByRole('button', { name: /Nv 60/ })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Agregar Aniimo' })).toHaveLength(1)
    const grupo = screen.getByRole('group', { name: 'Teams del grupo «Buildeado»' })
    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '1 Principal',
      '2 Jefes',
      '3 Torre',
      '4 Raid',
      '5 PvP'
    ])
    expect(within(grupo).getByRole('button', { name: '1 Principal' })).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(within(grupo).getByRole('button', { name: '2 Jefes' })).not.toHaveAttribute('aria-current')
  })

  it('un team suelto no muestra botones del grupo y ofrece Agrupar', async () => {
    await montarYAbrir('Farmeo')
    const migas = screen.getByRole('navigation', { name: 'Ubicación' })
    expect(within(migas).getAllByRole('button').map((b) => b.textContent)).toEqual(['Mis teams'])
    expect(within(migas).getByText('Farmeo')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /Teams del grupo/ })).toBeNull()
    expect(screen.queryByText(/Team \d de \d en/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Agrupar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sacar del grupo' })).toBeNull()
  })

  it('un team vacio muestra cuatro slots para agregar', async () => {
    await montarYAbrir('Farmeo')
    expect(screen.getAllByRole('button', { name: 'Agregar Aniimo' })).toHaveLength(4)
    expect(screen.getByText('0/4 Aniimo')).toBeInTheDocument()
  })

  it('tocar otro team del grupo muestra su pantalla', async () => {
    await montarYAbrir('Principal')
    fireEvent.click(screen.getByRole('button', { name: '3 Torre' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Torre' })).toBeInTheDocument()
    expect(screen.getByText('Team 3 de 5 en «Buildeado»')).toBeInTheDocument()
    expect(screen.queryByText('portada del grupo')).toBeNull()
    expect(screen.getByRole('button', { name: '3 Torre' })).toHaveAttribute('aria-current', 'true')
  })

  it('abrir una carta abre la ficha de ese slot', async () => {
    const api = await montarYAbrir('Principal')
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: /Irisalis/ }))
    await screen.findByRole('heading', { name: /Ficha del Aniimo/ })
    expect(api.teams.obtenerFicha).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: 1 })
  })

  it('Agregar Aniimo abre la ficha en blanco del slot', async () => {
    const api = await montarYAbrir('Principal')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Aniimo' }))
    await screen.findByRole('heading', { name: /Ficha del Aniimo \(slot 4\)/ })
    expect(api.teams.obtenerFicha).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: 4 })
  })

  it('cancelar la ficha vuelve a la pantalla del team', async () => {
    await montarYAbrir('Principal')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Aniimo' }))
    await screen.findByLabelText('Nombre')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Principal' })).toBeInTheDocument()
    expect(screen.getByText('3/4 Aniimo')).toBeInTheDocument()
  })

  it('guardar la ficha vuelve a la pantalla del team con el aviso Ficha guardada', async () => {
    const api = await montarYAbrir('Principal')
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Aniimo' }))
    await screen.findByLabelText('Nombre')
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo' } })
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      ...datosBase(),
      teams: datosBase().teams.map((team) =>
        team.id === PRINCIPAL.id
          ? { ...team, slots: team.slots.map((s) => (s.slot === 4 ? { ...s, aniimo: ORCUS } : s)) }
          : team
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Ficha guardada')
    expect(await screen.findByRole('heading', { level: 2, name: 'Principal' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('4/4 Aniimo')).toBeInTheDocument())
  })

  it('no usa atributos style', async () => {
    await montarYAbrir('Principal')
    expect(document.querySelectorAll('[style]')).toHaveLength(0)
    expect(cartasDelTeam()).toHaveLength(4)
  })
})

describe('migas y team inexistente', () => {
  it('la miga del grupo vuelve a Mis teams con ese grupo desplegado', async () => {
    await montarYAbrir('Principal')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ubicación' })).getByRole('button', { name: 'Buildeado' }))
    await verMisTeams()
    expect(screen.getByRole('button', { name: /^Buildeado / })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^Homeland / })).toHaveAttribute('aria-expanded', 'false')
  })

  it('la miga Mis teams vuelve a Mis teams con todo plegado', async () => {
    await montarYAbrir('Principal')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ubicación' })).getByRole('button', { name: 'Mis teams' }))
    await verMisTeams()
    expect(screen.getByRole('button', { name: /^Buildeado / })).toHaveAttribute('aria-expanded', 'false')
  })

  it('un team que ya no existe tras recargar vuelve a Mis teams con el mensaje de no encontrado', async () => {
    const api = await montar({ teams: [RAID], grupos: [] })
    api.teams.listar.mockResolvedValue({ ok: true, teams: [], grupos: [] })
    fireEvent.click(screen.getByRole('button', { name: /^Team Raid, / }))
    await verMisTeams()
    expect(screen.getByRole('status')).toHaveTextContent(
      'No se encontró el elemento, volvé a cargar la lista'
    )
  })

  it('sesion-vencida al cargar el team vuelve al login', async () => {
    const api = await montar({ teams: [RAID], grupos: [] })
    api.teams.listar.mockResolvedValue({ ok: false, error: 'sesion-vencida' })
    fireEvent.click(screen.getByRole('button', { name: /^Team Raid, / }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
  })
})

describe('ocultar un team a los amigos', () => {
  function casilla(): HTMLInputElement {
    return screen.getByRole('checkbox', { name: 'Oculto para amigos' })
  }

  it('un team visible muestra la casilla desmarcada', async () => {
    await montarYAbrir('Farmeo')
    expect(casilla().checked).toBe(false)
  })

  it('un team oculto muestra la casilla marcada y el texto una sola vez', async () => {
    await montarYAbrir('Jefes', datosBase(), {}, 'Buildeado')
    expect(casilla().checked).toBe(true)
    expect(screen.getAllByText('Oculto para amigos')).toHaveLength(1)
  })

  it('marcarla llama a cambiarVisibilidad, queda deshabilitada y despues marcada', async () => {
    const { promesa, resolver } = promesaManual()
    const api = await montarYAbrir('Farmeo', datosBase(), {
      teams: { cambiarVisibilidad: () => promesa }
    })
    fireEvent.click(casilla())
    await waitFor(() => expect(casilla()).toBeDisabled())
    expect(casilla().checked).toBe(false)
    expect(api.teams.cambiarVisibilidad).toHaveBeenCalledWith({
      teamId: FARMEO.id,
      ocultoParaAmigos: true
    })
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      ...datosBase(),
      teams: datosBase().teams.map((t) => (t.id === FARMEO.id ? { ...t, ocultoParaAmigos: true } : t))
    })
    resolver({ ok: true })
    await waitFor(() => expect(casilla()).toBeEnabled())
    expect(casilla().checked).toBe(true)
    expect(screen.getAllByText('Oculto para amigos')).toHaveLength(1)
  })

  it('desmarcarla envia ocultoParaAmigos en false', async () => {
    const api = await montarYAbrir('Jefes', datosBase(), {}, 'Buildeado')
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      ...datosBase(),
      teams: datosBase().teams.map((t) => (t.id === JEFES.id ? { ...t, ocultoParaAmigos: false } : t))
    })
    fireEvent.click(casilla())
    await waitFor(() => expect(casilla().checked).toBe(false))
    expect(api.teams.cambiarVisibilidad).toHaveBeenCalledWith({
      teamId: JEFES.id,
      ocultoParaAmigos: false
    })
  })

  it('con error vuelve al estado anterior y muestra el mensaje', async () => {
    await montarYAbrir('Farmeo', datosBase(), {
      teams: { cambiarVisibilidad: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    fireEvent.click(casilla())
    expect(
      await screen.findByText(
        'No se pudo conectar con el servidor. Revisá que el backend esté levantado.'
      )
    ).toBeInTheDocument()
    expect(casilla().checked).toBe(false)
    expect(casilla()).toBeEnabled()
  })
})

describe('renombrar y borrar el team', () => {
  it('renombrar envia el nombre y muestra el que devuelve la recarga', async () => {
    const api = await montarYAbrir('Farmeo')
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      ...datosBase(),
      teams: datosBase().teams.map((t) => (t.id === FARMEO.id ? { ...t, nombre: 'Nuevo' } : t))
    })
    fireEvent.change(screen.getByLabelText('Nuevo nombre'), { target: { value: 'Nuevo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Nuevo' })).toBeInTheDocument()
    expect(api.teams.renombrar).toHaveBeenCalledWith({ teamId: FARMEO.id, nombre: 'Nuevo' })
    expect(screen.queryByLabelText('Nuevo nombre')).toBeNull()
  })

  it('con datos-invalidos muestra el mensaje y conserva el titulo', async () => {
    await montarYAbrir('Farmeo', datosBase(), {
      teams: { renombrar: async () => ({ ok: false, error: 'datos-invalidos' }) }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    fireEvent.change(screen.getByLabelText('Nuevo nombre'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(
      await screen.findByText('El nombre del team debe tener entre 1 y 50 caracteres')
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Farmeo' })).toBeInTheDocument()
  })

  it('cancelar el renombrado cierra el campo sin llamar a la API', async () => {
    const api = await montarYAbrir('Farmeo')
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nuevo nombre')).toBeNull()
    expect(api.teams.renombrar).not.toHaveBeenCalled()
  })

  it('cancelar la confirmacion de borrado no llama a la API', async () => {
    const api = await montarYAbrir('Farmeo')
    fireEvent.click(screen.getByRole('button', { name: 'Borrar team' }))
    expect(screen.getByText(/Farmeo/, { selector: '[role="alertdialog"] *' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.teams.borrar).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 2, name: 'Farmeo' })).toBeInTheDocument()
  })

  it('confirmar borra y vuelve a Mis teams sin la pila', async () => {
    const api = await montarYAbrir('Farmeo')
    fireEvent.click(screen.getByRole('button', { name: 'Borrar team' }))
    api.teams.listar.mockResolvedValue({
      ok: true,
      ...datosBase(),
      teams: datosBase().teams.filter((t) => t.id !== FARMEO.id)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
    await verMisTeams()
    expect(api.teams.borrar).toHaveBeenCalledWith({ teamId: FARMEO.id })
    expect(screen.queryByRole('button', { name: /^Team Farmeo, / })).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('mientras espera el borrado deshabilita las acciones', async () => {
    const { promesa, resolver } = promesaManual()
    await montarYAbrir('Farmeo', datosBase(), { teams: { borrar: () => promesa } })
    fireEvent.click(screen.getByRole('button', { name: 'Borrar team' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Renombrar' })).toBeDisabled())
    for (const carta of screen.getAllByRole('button', { name: 'Agregar Aniimo' })) {
      expect(carta).toBeDisabled()
    }
    resolver({ ok: false, error: 'conflicto' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Renombrar' })).toBeEnabled())
    expect(
      await screen.findByText('No se pudo guardar por un conflicto, intentá de nuevo')
    ).toBeInTheDocument()
  })
})

describe('grupo del team', () => {
  it('Sacar del grupo llama a sacarTeam y la pantalla pasa a mostrar el team suelto', async () => {
    const api = await montarYAbrir('Raid', datosBase(), {}, 'Buildeado')
    const datos = datosBase()
    api.teams.listar.mockResolvedValue({
      ok: true,
      teams: datos.teams.map((t) => (t.id === RAID.id ? { ...t, grupoId: null } : t)),
      grupos: [{ ...datos.grupos[0]!, teamIds: [PRINCIPAL.id, JEFES.id, TORRE.id, PVP.id] }, datos.grupos[1]!]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sacar del grupo' }))
    expect(await screen.findByRole('button', { name: 'Agrupar' })).toBeInTheDocument()
    expect(api.grupos.sacarTeam).toHaveBeenCalledWith({
      grupoId: datos.grupos[0]!.id,
      teamId: RAID.id
    })
    expect(screen.queryByRole('group', { name: /Teams del grupo/ })).toBeNull()
    expect(
      within(screen.getByRole('navigation', { name: 'Ubicación' })).queryByRole('button', {
        name: 'Buildeado'
      })
    ).toBeNull()
  })

  it('Agrupar muestra el selector Grupo sin los grupos llenos y llama a agregarTeam', async () => {
    const api = await montarYAbrir('Farmeo')
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    const selector = screen.getByLabelText('Grupo') as HTMLSelectElement
    expect(Array.from(selector.options).map((o) => o.text)).toEqual(['Sin grupo', 'Homeland'])
    const datos = datosBase()
    const homeland = armarGrupo('Homeland', 2, [CASA, FARMEO])
    api.grupos.agregarTeam.mockResolvedValueOnce({
      ok: true,
      teams: [...datos.teams.filter((t) => t.grupoId === datos.grupos[0]!.id), ...homeland.teams],
      grupos: [datos.grupos[0]!, homeland.grupo]
    })
    fireEvent.change(selector, { target: { value: datos.grupos[1]!.id } })
    expect(api.grupos.agregarTeam).toHaveBeenCalledWith({
      grupoId: datos.grupos[1]!.id,
      teamId: FARMEO.id
    })
    expect(await screen.findByText('Team 2 de 2 en «Homeland»')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sacar del grupo' })).toBeInTheDocument()
  })

  it('con grupo-lleno muestra el mensaje y el team sigue suelto', async () => {
    await montarYAbrir('Farmeo', datosBase(), {
      grupos: { agregarTeam: async () => ({ ok: false, error: 'grupo-lleno' }) }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: datosBase().grupos[1]!.id } })
    expect(await screen.findByText('Ese grupo ya tiene el máximo de 5 teams')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agrupar' })).toBeInTheDocument()
  })
})

describe('abrir el team en el overlay', () => {
  it('llama a overlay.abrir con el id del team y queda deshabilitado mientras espera', async () => {
    const { promesa, resolver } = promesaManual()
    const api = await montarYAbrir('Farmeo', datosBase(), { overlay: { abrir: () => promesa } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir en overlay' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir en overlay' })).toBeDisabled())
    expect(api.overlay.abrir).toHaveBeenCalledWith({ teamId: FARMEO.id })
    resolver({ ok: true })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Abrir en overlay' })).toBeEnabled())
  })

  it('sesion-vencida vuelve al login con el aviso', async () => {
    await montarYAbrir('Farmeo', datosBase(), {
      overlay: { abrir: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir en overlay' }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
    expect(screen.getByText('Tu sesión venció, volvé a iniciar sesión')).toBeInTheDocument()
  })

  it.each(['error-inesperado', 'datos-invalidos'] as const)(
    'con %s muestra un mensaje generico sin cambiar las cartas',
    async (error) => {
      await montarYAbrir('Principal', datosBase(), {
        overlay: { abrir: async () => ({ ok: false, error }) }
      })
      fireEvent.click(screen.getByRole('button', { name: 'Abrir en overlay' }))
      expect(await screen.findByText('No se pudo abrir el overlay')).toBeInTheDocument()
      expect(cartasDelTeam()).toHaveLength(4)
      expect(screen.getByRole('button', { name: 'Abrir en overlay' })).toBeEnabled()
    }
  )
})

describe('sesion vencida en cada accion', () => {
  const ACCIONES: readonly [string, Parameters<typeof instalarApi>[0], () => void][] = [
    [
      'renombrar',
      { teams: { renombrar: async () => ({ ok: false, error: 'sesion-vencida' }) } },
      () => {
        fireEvent.click(screen.getByRole('button', { name: 'Renombrar' }))
        fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
      }
    ],
    [
      'visibilidad',
      { teams: { cambiarVisibilidad: async () => ({ ok: false, error: 'sesion-vencida' }) } },
      () => fireEvent.click(screen.getByRole('checkbox', { name: 'Oculto para amigos' }))
    ],
    [
      'borrar',
      { teams: { borrar: async () => ({ ok: false, error: 'sesion-vencida' }) } },
      () => {
        fireEvent.click(screen.getByRole('button', { name: 'Borrar team' }))
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
      }
    ],
    [
      'agrupar',
      { grupos: { agregarTeam: async () => ({ ok: false, error: 'sesion-vencida' }) } },
      () => {
        fireEvent.click(screen.getByRole('button', { name: 'Agrupar' }))
        fireEvent.change(screen.getByLabelText('Grupo'), {
          target: { value: datosBase().grupos[1]!.id }
        })
      }
    ]
  ]

  it.each(ACCIONES)('al %s vuelve al login', async (_nombre, extra, accion) => {
    await montarYAbrir('Farmeo', datosBase(), extra)
    accion()
    await screen.findByRole('button', { name: 'Iniciar sesión' })
  })
})

describe('portada del team', () => {
  function selector(): HTMLSelectElement {
    fireEvent.click(screen.getByRole('button', { name: 'Elegir portada' }))
    return screen.getByLabelText('Portada') as HTMLSelectElement
  }

  function cartasConMarca(): HTMLElement[] {
    return cartasDelTeam().filter((carta) => within(carta).queryByText('Portada') !== null)
  }

  it('Elegir portada muestra Automatica y los slots ocupados por nombre', async () => {
    const api = await montarYAbrir('Principal')
    expect(screen.queryByLabelText('Portada')).toBeNull()
    const campo = selector()
    expect(Array.from(campo.options).map((o) => o.text)).toEqual([
      'Automática',
      'Irisalis',
      'Orcus',
      'Demoflama'
    ])
    expect(campo.value).toBe('')
    fireEvent.change(campo, { target: { value: '3' } })
    expect(api.teams.elegirPortada).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: 3 })
  })

  it('muestra la portada elegida y vuelve a Automatica con null', async () => {
    const datos = datosBase()
    const api = await montarYAbrir('Principal', {
      teams: datos.teams.map((t) =>
        t.id === PRINCIPAL.id ? { ...t, portadaSlot: 3, portadaEfectivaSlot: 3 } : t
      ),
      grupos: datos.grupos
    })
    const campo = selector()
    expect(campo.value).toBe('3')
    fireEvent.change(campo, { target: { value: '' } })
    expect(api.teams.elegirPortada).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: null })
  })

  it('tras elegir recarga y la carta elegida lleva la marca Portada', async () => {
    const api = await montarYAbrir('Principal')
    const campo = selector()
    const datos = datosBase()
    api.teams.listar.mockResolvedValue({
      ok: true,
      grupos: datos.grupos,
      teams: datos.teams.map((t) =>
        t.id === PRINCIPAL.id ? { ...t, portadaSlot: 3, portadaEfectivaSlot: 3 } : t
      )
    })
    fireEvent.change(campo, { target: { value: '3' } })
    await waitFor(() => expect(cartasConMarca()).toHaveLength(1))
    expect(within(cartasConMarca()[0]!).getByText('Demoflama')).toBeInTheDocument()
  })

  it('con portada automatica la marca esta en la primera carta ocupada', async () => {
    const datos = datosBase()
    await montarYAbrir('Principal', {
      teams: datos.teams.map((t) =>
        t.id === PRINCIPAL.id
          ? {
              ...t,
              slots: t.slots.map((s) => (s.slot === 1 ? { ...s, aniimo: null } : s)),
              portadaEfectivaSlot: 2
            }
          : t
      ),
      grupos: datos.grupos
    })
    expect(cartasConMarca()).toHaveLength(1)
    expect(within(cartasConMarca()[0]!).getByText('Orcus')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Elegir portada' }))
    expect((screen.getByLabelText('Portada') as HTMLSelectElement).value).toBe('')
  })

  it('un team vacio no ofrece Elegir portada ni marca', async () => {
    await montarYAbrir('Farmeo')
    expect(screen.queryByRole('button', { name: 'Elegir portada' })).toBeNull()
    expect(screen.queryByText('Portada')).toBeNull()
  })
})
