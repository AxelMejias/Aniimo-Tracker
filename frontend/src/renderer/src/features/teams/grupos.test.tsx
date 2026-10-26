// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  armarGrupo,
  instalarApi,
  RESUMEN_DE_IRISALIS,
  teamDePrueba
} from '../../../../../tests/fixtures/apiFalsa'
import type { GrupoResumen, TeamResumen } from '../../../../shared/teams'
import App from '../../App'

afterEach(cleanup)

const TIPO_TEAM = 'application/x-aniimo-team'
const TIPO_GRUPO = 'application/x-aniimo-grupo'

const ORCUS = { ...RESUMEN_DE_IRISALIS, nombre: 'Orcus' }

const PRINCIPAL = teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS, 3: ORCUS })
const RAID = teamDePrueba('Raid', 2)
const JEFES = teamDePrueba('Jefes', 3)
const CASA = teamDePrueba('Casa', 4)
const FARMEO = teamDePrueba('Farmeo', 5)
const EVENTOS = teamDePrueba('Eventos', 6)

function promesaManual() {
  let resolver: (valor: unknown) => void = () => undefined
  const promesa = new Promise<never>((resolve) => {
    resolver = (valor) => resolve(valor as never)
  })
  return { promesa, resolver: (valor: unknown) => resolver(valor) }
}

interface Datos {
  readonly teams: readonly TeamResumen[]
  readonly grupos: readonly GrupoResumen[]
}

function datosBase(): Datos {
  const buildeado = armarGrupo('Buildeado', 1, [PRINCIPAL, RAID, JEFES])
  const homeland = armarGrupo('Homeland', 2, [CASA])
  return {
    teams: [...buildeado.teams, ...homeland.teams, FARMEO, EVENTOS],
    grupos: [buildeado.grupo, homeland.grupo]
  }
}

async function montar(datos: Datos = datosBase(), extra: Parameters<typeof instalarApi>[0] = {}) {
  const api = instalarApi({
    ...extra,
    teams: { listar: async () => ({ ok: true, ...datos }), ...extra.teams }
  })
  render(<App />)
  await screen.findByRole('heading', { name: 'Mis teams' })
  await waitFor(() => expect(screen.queryByText('Cargando teams…')).toBeNull())
  return api
}

function region(nombre: string): HTMLElement {
  return screen.getByRole('region', { name: nombre })
}

function encabezadoDe(nombre: string): HTMLElement {
  const encabezado = within(region(nombre)).getByRole('heading', { name: nombre }).closest('header')
  if (encabezado === null) {
    throw new Error(`Sin encabezado para ${nombre}`)
  }
  return encabezado
}

function nombresDeTeams(contenedor: HTMLElement): string[] {
  return within(contenedor)
    .getAllByRole('heading', { level: 4 })
    .map((encabezado) => encabezado.textContent ?? '')
}

describe('contador y secciones por grupo', () => {
  it('muestra el contador n/20 teams', async () => {
    await montar()
    expect(screen.getByText('6/20 teams')).toBeInTheDocument()
  })

  it('con cero teams el contador es 0/20 teams y no hay secciones', async () => {
    await montar({ teams: [], grupos: [] })
    expect(screen.getByText('0/20 teams')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sin grupo' })).toBeNull()
  })

  it('con cuatro teams propone Team 5', async () => {
    const cuatro = [1, 2, 3, 4].map((n) => teamDePrueba(`T${n}`, n))
    await montar({ teams: cuatro, grupos: [] })
    fireEvent.click(screen.getByRole('button', { name: 'Crear team' }))
    expect((screen.getByLabelText('Nombre del team') as HTMLInputElement).value).toBe('Team 5')
    expect(screen.getByText('4/20 teams')).toBeInTheDocument()
  })

  it('con veinte teams no ofrece Crear team y avisa del maximo', async () => {
    const veinte = Array.from({ length: 20 }, (_, i) => teamDePrueba(`Team ${i + 1}`, i + 1))
    await montar({ teams: veinte, grupos: [] })
    expect(screen.queryByRole('button', { name: 'Crear team' })).toBeNull()
    expect(screen.getByText('Llegaste al máximo de 20 teams.')).toBeInTheDocument()
    expect(screen.getByText('20/20 teams')).toBeInTheDocument()
  })

  it('sin teams muestra el estado vacio con el maximo', async () => {
    await montar({ teams: [], grupos: [] })
    expect(
      screen.getByText('Todavía no tenés teams. Creá el primero (podés tener hasta 20).')
    ).toBeInTheDocument()
  })

  it('muestra una seccion por grupo en orden y Sin grupo al final', async () => {
    await montar()
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos).toEqual(['Buildeado', 'Homeland', 'Sin grupo'])
    const buildeado = within(region('Buildeado'))
    expect(buildeado.getByText('3/5 teams')).toBeInTheDocument()
    expect(nombresDeTeams(region('Buildeado'))).toEqual(['Principal', 'Raid', 'Jefes'])
    expect(within(region('Homeland')).getByText('1/5 teams')).toBeInTheDocument()
    expect(nombresDeTeams(region('Sin grupo'))).toEqual(['Farmeo', 'Eventos'])
  })

  it('ordena los grupos por orden aunque lleguen desordenados', async () => {
    const datos = datosBase()
    await montar({ teams: datos.teams, grupos: [...datos.grupos].reverse() })
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos.slice(0, 2)).toEqual(['Buildeado', 'Homeland'])
  })

  it('sin grupos pero con teams sueltos muestra solo Sin grupo', async () => {
    await montar({ teams: [FARMEO], grupos: [] })
    expect(nombresDeTeams(region('Sin grupo'))).toEqual(['Farmeo'])
  })

  it('no usa atributos style', async () => {
    instalarApi({ teams: { listar: async () => ({ ok: true, ...datosBase() }) } })
    const { container } = render(<App />)
    await screen.findByRole('region', { name: 'Buildeado' })
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('nuevo grupo', () => {
  it('abre un formulario con el campo vacio, placeholder de ejemplo y Crear grupo deshabilitado', async () => {
    await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }))
    const campo = screen.getByLabelText('Nombre del grupo') as HTMLInputElement
    expect(campo.value).toBe('')
    expect(campo.placeholder).toBe('Ej.: Buildeado')
    expect(campo.maxLength).toBe(50)
    expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeDisabled()
  })

  it('crea el grupo con el nombre escrito y recarga con la respuesta', async () => {
    const homeland = armarGrupo('Mi grupo', 3, [])
    const api = await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }))
    fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: ' Mi grupo ' } })
    const datos = datosBase()
    api.grupos.crear.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams,
      grupos: [...datos.grupos, homeland.grupo]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))
    expect(await screen.findByRole('heading', { name: 'Mi grupo' })).toBeInTheDocument()
    expect(api.grupos.crear).toHaveBeenCalledWith({ nombre: 'Mi grupo' })
    expect(screen.queryByLabelText('Nombre del grupo')).toBeNull()
  })

  it('con solo espacios Crear grupo sigue deshabilitado', async () => {
    const api = await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }))
    fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Hola' } })
    expect(screen.getByRole('button', { name: 'Crear grupo' })).toBeEnabled()
    expect(api.grupos.crear).not.toHaveBeenCalled()
  })

  it('Cancelar cierra el formulario sin llamar a la API', async () => {
    const api = await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nombre del grupo')).toBeNull()
    expect(screen.getByRole('button', { name: 'Nuevo grupo' })).toBeInTheDocument()
    expect(api.grupos.crear).not.toHaveBeenCalled()
  })

  it('con cuatro grupos no ofrece Nuevo grupo y avisa del maximo', async () => {
    const grupos = [1, 2, 3, 4].map((n) => armarGrupo(`G${n}`, n, []))
    await montar({ teams: [], grupos: grupos.map((g) => g.grupo) })
    expect(screen.queryByRole('button', { name: 'Nuevo grupo' })).toBeNull()
    expect(screen.getByText('Llegaste al máximo de 4 grupos.')).toBeInTheDocument()
  })

  it('con limite-de-grupos muestra el mensaje y deja el formulario abierto', async () => {
    await montar(datosBase(), {
      grupos: { crear: async () => ({ ok: false, error: 'limite-de-grupos' }) }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }))
    fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Otro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))
    expect(await screen.findByText('Ya tenés el máximo de 4 grupos')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del grupo')).toBeInTheDocument()
  })

  it('con sesion-vencida vuelve al login', async () => {
    await montar(datosBase(), {
      grupos: { crear: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }))
    fireEvent.change(screen.getByLabelText('Nombre del grupo'), { target: { value: 'Otro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))
    await screen.findByRole('button', { name: 'Iniciar sesión' })
  })
})

describe('renombrar y borrar grupo', () => {
  it('renombra el grupo y muestra el nombre de la respuesta', async () => {
    const api = await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar grupo Buildeado' }))
    const datos = datosBase()
    api.grupos.renombrar.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams,
      grupos: [{ ...datos.grupos[0]!, nombre: 'Principales' }, datos.grupos[1]!]
    })
    fireEvent.change(screen.getByLabelText('Nuevo nombre del grupo'), {
      target: { value: 'Principales' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre del grupo' }))
    expect(await screen.findByRole('heading', { name: 'Principales' })).toBeInTheDocument()
    expect(api.grupos.renombrar).toHaveBeenCalledWith({
      grupoId: datos.grupos[0]!.id,
      nombre: 'Principales'
    })
  })

  it('con datos-invalidos muestra el mensaje en la seccion y conserva el nombre', async () => {
    await montar(datosBase(), {
      grupos: { renombrar: async () => ({ ok: false, error: 'datos-invalidos' }) }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Renombrar grupo Homeland' }))
    fireEvent.change(screen.getByLabelText('Nuevo nombre del grupo'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre del grupo' }))
    expect(
      await within(region('Homeland')).findByText(
        'El nombre del grupo debe tener entre 1 y 50 caracteres'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Homeland' })).toBeInTheDocument()
  })

  it('cancelar el borrado no llama a la API', async () => {
    const api = await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar grupo Homeland' }))
    expect(
      screen.getByText(/Los teams quedan sin grupo/, { selector: '[role="alertdialog"] *' })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.grupos.borrar).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('confirmar borra el grupo y sus teams aparecen en Sin grupo', async () => {
    const api = await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar grupo Homeland' }))
    const datos = datosBase()
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams.map((team) => (team.id === CASA.id ? { ...team, grupoId: null } : team)),
      grupos: [datos.grupos[0]!]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Homeland' })).toBeNull())
    expect(api.grupos.borrar).toHaveBeenCalledWith({ grupoId: datos.grupos[1]!.id })
    expect(nombresDeTeams(region('Sin grupo'))).toContain('Casa')
  })
})

describe('selector Grupo de cada team', () => {
  function selectorDe(nombre: string): HTMLSelectElement {
    return within(region(nombre)).getByLabelText('Grupo') as HTMLSelectElement
  }

  function opciones(selector: HTMLSelectElement): string[] {
    return Array.from(selector.options).map((opcion) => opcion.text)
  }

  it('ofrece Sin grupo, el grupo actual y los grupos con lugar', async () => {
    await montar()
    expect(opciones(selectorDe('Raid'))).toEqual(['Sin grupo', 'Buildeado', 'Homeland'])
    expect(selectorDe('Raid').value).toBe(datosBase().grupos[0]!.id)
    expect(selectorDe('Farmeo').value).toBe('')
  })

  it('no ofrece un grupo con cinco teams a un team de otro ambito', async () => {
    const cinco = [1, 2, 3, 4, 5].map((n) => teamDePrueba(`Lleno ${n}`, n))
    const lleno = armarGrupo('Lleno', 1, cinco)
    const suelto = teamDePrueba('Suelto', 6)
    await montar({ teams: [...lleno.teams, suelto], grupos: [lleno.grupo] })
    expect(opciones(selectorDe('Suelto'))).toEqual(['Sin grupo'])
    expect(opciones(selectorDe('Lleno 1'))).toEqual(['Sin grupo', 'Lleno'])
  })

  it('agregar a un grupo llama a grupos.agregarTeam, espera deshabilitado y usa la respuesta', async () => {
    const { promesa, resolver } = promesaManual()
    const api = await montar(datosBase(), { grupos: { agregarTeam: () => promesa } })
    const datos = datosBase()
    fireEvent.change(selectorDe('Farmeo'), { target: { value: datos.grupos[1]!.id } })
    expect(api.grupos.agregarTeam).toHaveBeenCalledWith({
      grupoId: datos.grupos[1]!.id,
      teamId: FARMEO.id
    })
    await waitFor(() => expect(selectorDe('Farmeo')).toBeDisabled())
    const homeland = armarGrupo('Homeland', 2, [CASA, FARMEO])
    resolver({
      ok: true,
      teams: [
        ...datos.teams.filter((t) => t.grupoId === datos.grupos[0]!.id),
        ...homeland.teams,
        EVENTOS
      ],
      grupos: [datos.grupos[0]!, homeland.grupo]
    })
    await waitFor(() => expect(nombresDeTeams(region('Homeland'))).toEqual(['Casa', 'Farmeo']))
    expect(within(region('Homeland')).getByText('2/5 teams')).toBeInTheDocument()
  })

  it('mover entre grupos llama a agregarTeam con el grupo destino', async () => {
    const api = await montar()
    const datos = datosBase()
    fireEvent.change(selectorDe('Raid'), { target: { value: datos.grupos[1]!.id } })
    expect(api.grupos.agregarTeam).toHaveBeenCalledWith({
      grupoId: datos.grupos[1]!.id,
      teamId: RAID.id
    })
    expect(api.grupos.sacarTeam).not.toHaveBeenCalled()
  })

  it('elegir Sin grupo llama a sacarTeam con el grupo actual y recarga la lista', async () => {
    const api = await montar()
    const datos = datosBase()
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams.map((team) => (team.id === RAID.id ? { ...team, grupoId: null } : team)),
      grupos: [{ ...datos.grupos[0]!, teamIds: [PRINCIPAL.id, JEFES.id] }, datos.grupos[1]!]
    })
    fireEvent.change(selectorDe('Raid'), { target: { value: '' } })
    expect(api.grupos.sacarTeam).toHaveBeenCalledWith({
      grupoId: datos.grupos[0]!.id,
      teamId: RAID.id
    })
    await waitFor(() => expect(nombresDeTeams(region('Sin grupo'))).toContain('Raid'))
    expect(nombresDeTeams(region('Buildeado'))).toEqual(['Principal', 'Jefes'])
  })

  it('con grupo-lleno muestra el mensaje en el team y no lo mueve', async () => {
    await montar(datosBase(), {
      grupos: { agregarTeam: async () => ({ ok: false, error: 'grupo-lleno' }) }
    })
    fireEvent.change(selectorDe('Farmeo'), { target: { value: datosBase().grupos[1]!.id } })
    expect(
      await within(region('Farmeo')).findByText('Ese grupo ya tiene el máximo de 5 teams')
    ).toBeInTheDocument()
    expect(nombresDeTeams(region('Sin grupo'))).toContain('Farmeo')
    expect(selectorDe('Farmeo').value).toBe('')
  })
})

describe('portadas', () => {
  it('el selector Portada del grupo ofrece Automatica y los teams del grupo', async () => {
    const api = await montar()
    const selector = within(region('Buildeado')).getByLabelText('Portada del grupo') as HTMLSelectElement
    expect(Array.from(selector.options).map((o) => o.text)).toEqual([
      'Automática',
      'Principal',
      'Raid',
      'Jefes'
    ])
    expect(selector.value).toBe('')
    fireEvent.change(selector, { target: { value: JEFES.id } })
    expect(api.grupos.elegirPortada).toHaveBeenCalledWith({
      grupoId: datosBase().grupos[0]!.id,
      teamId: JEFES.id
    })
  })

  it('volver a Automatica llama con teamId null y muestra la portada elegida', async () => {
    const datos = datosBase()
    const grupos = [{ ...datos.grupos[0]!, portadaTeamId: RAID.id }, datos.grupos[1]!]
    const api = await montar({ teams: datos.teams, grupos })
    const selector = within(region('Buildeado')).getByLabelText('Portada del grupo') as HTMLSelectElement
    expect(selector.value).toBe(RAID.id)
    fireEvent.change(selector, { target: { value: '' } })
    expect(api.grupos.elegirPortada).toHaveBeenCalledWith({
      grupoId: datos.grupos[0]!.id,
      teamId: null
    })
  })

  it('el selector Portada del team ofrece Automatica y los slots ocupados por nombre', async () => {
    const api = await montar()
    const selector = within(region('Principal')).getByLabelText('Portada') as HTMLSelectElement
    expect(Array.from(selector.options).map((o) => o.text)).toEqual(['Automática', 'Irisalis', 'Orcus'])
    expect(selector.value).toBe('')
    fireEvent.change(selector, { target: { value: '3' } })
    expect(api.teams.elegirPortada).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: 3 })
  })

  it('el selector Portada del team muestra la elegida y vuelve a Automatica con null', async () => {
    const datos = datosBase()
    const api = await montar({
      teams: datos.teams.map((team) =>
        team.id === PRINCIPAL.id ? { ...team, portadaSlot: 3, portadaEfectivaSlot: 3 } : team
      ),
      grupos: datos.grupos
    })
    const selector = within(region('Principal')).getByLabelText('Portada') as HTMLSelectElement
    expect(selector.value).toBe('3')
    fireEvent.change(selector, { target: { value: '' } })
    expect(api.teams.elegirPortada).toHaveBeenCalledWith({ teamId: PRINCIPAL.id, slot: null })
  })

  it('marca como Portada la tarjeta efectiva y ninguna otra', async () => {
    const datos = datosBase()
    await montar({
      teams: datos.teams.map((team) =>
        team.id === PRINCIPAL.id ? { ...team, portadaEfectivaSlot: 3 } : team
      ),
      grupos: datos.grupos
    })
    const tarjetas = within(region('Principal')).getAllByRole('button', { name: /Nivel|Agregar Aniimo/ })
    const marcadas = tarjetas.filter((tarjeta) => within(tarjeta).queryByText('Portada') !== null)
    expect(marcadas).toHaveLength(1)
    expect(within(marcadas[0]!).getByText('Orcus')).toBeInTheDocument()
  })

  it('un team vacio no ofrece el selector Portada ni marca', async () => {
    await montar()
    expect(within(region('Raid')).queryByLabelText('Portada')).toBeNull()
    expect(within(region('Raid')).queryByText('Portada')).toBeNull()
  })

  it('elegir portada recarga con la respuesta del listado', async () => {
    const api = await montar()
    const datos = datosBase()
    api.teams.listar.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams.map((team) =>
        team.id === PRINCIPAL.id ? { ...team, portadaSlot: 3, portadaEfectivaSlot: 3 } : team
      ),
      grupos: datos.grupos
    })
    fireEvent.change(within(region('Principal')).getByLabelText('Portada'), {
      target: { value: '3' }
    })
    await waitFor(() =>
      expect((within(region('Principal')).getByLabelText('Portada') as HTMLSelectElement).value).toBe('3')
    )
  })
})

interface Transferencia {
  setData: ReturnType<typeof vi.fn>
  types: string[]
  effectAllowed: string
  dropEffect: string
  files?: File[]
}

function transferencia(tipo: string): Transferencia {
  return { setData: vi.fn(), types: [tipo], effectAllowed: '', dropEffect: '' }
}

function arrastrar(origen: HTMLElement, destino: HTMLElement, tipo: string): void {
  const dataTransfer = transferencia(tipo)
  fireEvent.dragStart(origen, { dataTransfer })
  fireEvent.dragOver(destino, { dataTransfer })
  fireEvent.drop(destino, { dataTransfer })
}

function ningunCanalDeOrden(api: Awaited<ReturnType<typeof montar>>): void {
  expect(api.grupos.ordenar).not.toHaveBeenCalled()
  expect(api.grupos.ordenarTeams).not.toHaveBeenCalled()
  expect(api.grupos.ordenarSueltos).not.toHaveBeenCalled()
  expect(api.grupos.agregarTeam).not.toHaveBeenCalled()
  expect(api.grupos.sacarTeam).not.toHaveBeenCalled()
}

describe('arrastrar y soltar', () => {
  it('soltar un grupo sobre otro llama a grupos.ordenar con la lista completa', async () => {
    const api = await montar()
    const datos = datosBase()
    arrastrar(encabezadoDe('Homeland'), region('Buildeado'), TIPO_GRUPO)
    await waitFor(() =>
      expect(api.grupos.ordenar).toHaveBeenCalledWith({
        grupoIds: [datos.grupos[1]!.id, datos.grupos[0]!.id]
      })
    )
  })

  it('la vista muestra el orden de la respuesta', async () => {
    const api = await montar()
    const datos = datosBase()
    api.grupos.ordenar.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams,
      grupos: [
        { ...datos.grupos[1]!, orden: 1 },
        { ...datos.grupos[0]!, orden: 2 }
      ]
    })
    arrastrar(encabezadoDe('Homeland'), region('Buildeado'), TIPO_GRUPO)
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        'Homeland',
        'Buildeado',
        'Sin grupo'
      ])
    )
  })

  it('soltar un team sobre otro de su grupo llama a ordenarTeams con la lista completa', async () => {
    const api = await montar()
    arrastrar(encabezadoDe('Jefes'), region('Principal'), TIPO_TEAM)
    await waitFor(() =>
      expect(api.grupos.ordenarTeams).toHaveBeenCalledWith({
        grupoId: datosBase().grupos[0]!.id,
        teamIds: [JEFES.id, PRINCIPAL.id, RAID.id]
      })
    )
  })

  it('soltar un team suelto sobre otro llama a ordenarSueltos', async () => {
    const api = await montar()
    arrastrar(encabezadoDe('Eventos'), region('Farmeo'), TIPO_TEAM)
    await waitFor(() =>
      expect(api.grupos.ordenarSueltos).toHaveBeenCalledWith({ teamIds: [EVENTOS.id, FARMEO.id] })
    )
  })

  it('soltar un team suelto sobre la seccion de un grupo llama a agregarTeam', async () => {
    const api = await montar()
    arrastrar(encabezadoDe('Farmeo'), region('Homeland'), TIPO_TEAM)
    await waitFor(() =>
      expect(api.grupos.agregarTeam).toHaveBeenCalledWith({
        grupoId: datosBase().grupos[1]!.id,
        teamId: FARMEO.id
      })
    )
    expect(api.grupos.ordenar).not.toHaveBeenCalled()
    expect(api.grupos.ordenarTeams).not.toHaveBeenCalled()
  })

  it('soltar un team de un grupo sobre Sin grupo llama a sacarTeam con su grupo', async () => {
    const api = await montar()
    arrastrar(encabezadoDe('Raid'), region('Sin grupo'), TIPO_TEAM)
    await waitFor(() =>
      expect(api.grupos.sacarTeam).toHaveBeenCalledWith({
        grupoId: datosBase().grupos[0]!.id,
        teamId: RAID.id
      })
    )
  })

  it('un grupo con cinco teams no se marca como destino ni llama a la API', async () => {
    const cinco = [1, 2, 3, 4, 5].map((n) => teamDePrueba(`Lleno ${n}`, n))
    const lleno = armarGrupo('Lleno', 1, cinco)
    const suelto = teamDePrueba('Suelto', 6)
    const api = await montar({ teams: [...lleno.teams, suelto], grupos: [lleno.grupo] })
    const dataTransfer = transferencia(TIPO_TEAM)
    fireEvent.dragStart(encabezadoDe('Suelto'), { dataTransfer })
    fireEvent.dragOver(region('Lleno'), { dataTransfer })
    expect(region('Lleno').className).not.toMatch(/--destino/)
    fireEvent.drop(region('Lleno'), { dataTransfer })
    ningunCanalDeOrden(api)
  })

  it('marca el destino valido con una clase y sin style', async () => {
    await montar()
    const dataTransfer = transferencia(TIPO_TEAM)
    fireEvent.dragStart(encabezadoDe('Farmeo'), { dataTransfer })
    fireEvent.dragOver(region('Homeland'), { dataTransfer })
    expect(region('Homeland').className).toMatch(/--destino/)
    expect(region('Homeland').getAttribute('style')).toBeNull()
    fireEvent.dragEnd(encabezadoDe('Farmeo'), { dataTransfer })
    expect(region('Homeland').className).not.toMatch(/--destino/)
  })

  it('soltar sobre si mismo no llama a nada', async () => {
    const api = await montar()
    arrastrar(encabezadoDe('Raid'), region('Raid'), TIPO_TEAM)
    arrastrar(encabezadoDe('Homeland'), region('Homeland'), TIPO_GRUPO)
    ningunCanalDeOrden(api)
  })

  it('un archivo soltado no llama a nada', async () => {
    const api = await montar()
    const archivo = new File(['x'], 'imagen.png', { type: 'image/png' })
    const dataTransfer = { types: ['Files'], files: [archivo], dropEffect: '' }
    fireEvent.dragOver(region('Homeland'), { dataTransfer })
    fireEvent.drop(region('Homeland'), { dataTransfer })
    fireEvent.drop(region('Farmeo'), { dataTransfer })
    ningunCanalDeOrden(api)
    expect(region('Homeland').className).not.toMatch(/--destino/)
  })

  it('un link o texto soltado no llama a nada', async () => {
    const api = await montar()
    const dataTransfer = { types: ['text/uri-list', 'text/plain'], dropEffect: '' }
    fireEvent.drop(region('Homeland'), { dataTransfer })
    fireEvent.drop(region('Sin grupo'), { dataTransfer })
    ningunCanalDeOrden(api)
  })

  it('un tipo propio sin haber empezado el arrastre desde la app tampoco hace nada', async () => {
    const api = await montar()
    fireEvent.drop(region('Homeland'), { dataTransfer: transferencia(TIPO_TEAM) })
    ningunCanalDeOrden(api)
  })

  it('un team arrastrado no se acepta como grupo y viceversa', async () => {
    const api = await montar()
    const dataTransfer = transferencia(TIPO_GRUPO)
    fireEvent.dragStart(encabezadoDe('Farmeo'), { dataTransfer: transferencia(TIPO_TEAM) })
    fireEvent.drop(region('Homeland'), { dataTransfer })
    ningunCanalDeOrden(api)
  })

  it('mientras guarda no se puede arrastrar ni soltar', async () => {
    const { promesa, resolver } = promesaManual()
    const api = await montar(datosBase(), { grupos: { ordenar: () => promesa } })
    arrastrar(encabezadoDe('Homeland'), region('Buildeado'), TIPO_GRUPO)
    await waitFor(() => expect(encabezadoDe('Homeland').draggable).toBe(false))
    expect(encabezadoDe('Raid').draggable).toBe(false)
    arrastrar(encabezadoDe('Eventos'), region('Farmeo'), TIPO_TEAM)
    expect(api.grupos.ordenarSueltos).not.toHaveBeenCalled()
    const datos = datosBase()
    resolver({ ok: true, teams: datos.teams, grupos: datos.grupos })
    await waitFor(() => expect(encabezadoDe('Homeland').draggable).toBe(true))
  })

  it('con conflicto muestra el mensaje y recarga la lista', async () => {
    const api = await montar(datosBase(), {
      grupos: { ordenar: async () => ({ ok: false, error: 'conflicto' }) }
    })
    arrastrar(encabezadoDe('Homeland'), region('Buildeado'), TIPO_GRUPO)
    expect(
      await screen.findByText('No se pudo guardar por un conflicto, intentá de nuevo')
    ).toBeInTheDocument()
    await waitFor(() => expect(api.teams.listar).toHaveBeenCalledTimes(2))
  })

  it('con grupo-lleno al soltar muestra el mensaje en la seccion destino', async () => {
    await montar(datosBase(), {
      grupos: { agregarTeam: async () => ({ ok: false, error: 'grupo-lleno' }) }
    })
    arrastrar(encabezadoDe('Farmeo'), region('Homeland'), TIPO_TEAM)
    expect(
      await within(region('Homeland')).findByText('Ese grupo ya tiene el máximo de 5 teams')
    ).toBeInTheDocument()
  })

  it('con sesion-vencida vuelve al login', async () => {
    await montar(datosBase(), {
      grupos: { ordenar: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    arrastrar(encabezadoDe('Homeland'), region('Buildeado'), TIPO_GRUPO)
    await screen.findByRole('button', { name: 'Iniciar sesión' })
  })
})

describe('Subir y Bajar con teclado', () => {
  function botonActivo(): string | null {
    return document.activeElement?.getAttribute('aria-label') ?? null
  }

  it('cada grupo y cada team tienen botones con nombre accesible', async () => {
    await montar()
    for (const nombre of [
      'Subir grupo Buildeado',
      'Bajar grupo Buildeado',
      'Subir team Principal',
      'Bajar team Raid',
      'Subir team Farmeo'
    ]) {
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument()
    }
  })

  it('estan deshabilitados en los extremos de su ambito', async () => {
    await montar()
    expect(screen.getByRole('button', { name: 'Subir grupo Buildeado' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar grupo Buildeado' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Bajar grupo Homeland' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subir team Principal' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar team Jefes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar team Eventos' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Subir team Casa' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bajar team Casa' })).toBeDisabled()
  })

  it('se alcanzan con Tab y Bajar team llama a ordenarTeams con el par intercambiado', async () => {
    const api = await montar()
    const datos = datosBase()
    const boton = screen.getByRole('button', { name: 'Bajar team Principal' })
    boton.focus()
    expect(document.activeElement).toBe(boton)
    api.grupos.ordenarTeams.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams,
      grupos: [{ ...datos.grupos[0]!, teamIds: [RAID.id, PRINCIPAL.id, JEFES.id] }, datos.grupos[1]!]
    })
    fireEvent.click(boton)
    await waitFor(() =>
      expect(api.grupos.ordenarTeams).toHaveBeenCalledWith({
        grupoId: datos.grupos[0]!.id,
        teamIds: [RAID.id, PRINCIPAL.id, JEFES.id]
      })
    )
    await waitFor(() => expect(nombresDeTeams(region('Buildeado'))).toEqual(['Raid', 'Principal', 'Jefes']))
    await waitFor(() => expect(botonActivo()).toBe('Bajar team Principal'))
  })

  it('si el elemento queda en un extremo el foco pasa al otro boton', async () => {
    const api = await montar()
    const datos = datosBase()
    api.grupos.ordenarTeams.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams,
      grupos: [{ ...datos.grupos[0]!, teamIds: [PRINCIPAL.id, JEFES.id, RAID.id] }, datos.grupos[1]!]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bajar team Raid' }))
    await waitFor(() => expect(botonActivo()).toBe('Subir team Raid'))
  })

  it('Subir grupo llama a ordenar con la lista intercambiada y el foco pasa al otro boton del grupo', async () => {
    const api = await montar()
    const datos = datosBase()
    api.grupos.ordenar.mockResolvedValueOnce({
      ok: true,
      teams: datos.teams,
      grupos: [
        { ...datos.grupos[1]!, orden: 1 },
        { ...datos.grupos[0]!, orden: 2 }
      ]
    })
    fireEvent.click(screen.getByRole('button', { name: 'Subir grupo Homeland' }))
    await waitFor(() =>
      expect(api.grupos.ordenar).toHaveBeenCalledWith({
        grupoIds: [datos.grupos[1]!.id, datos.grupos[0]!.id]
      })
    )
    await waitFor(() => expect(botonActivo()).toBe('Bajar grupo Homeland'))
  })

  it('Bajar un team suelto llama a ordenarSueltos', async () => {
    const api = await montar()
    fireEvent.click(screen.getByRole('button', { name: 'Bajar team Farmeo' }))
    await waitFor(() =>
      expect(api.grupos.ordenarSueltos).toHaveBeenCalledWith({ teamIds: [EVENTOS.id, FARMEO.id] })
    )
  })

  it('mientras guarda los botones quedan deshabilitados', async () => {
    const { promesa, resolver } = promesaManual()
    await montar(datosBase(), { grupos: { ordenarSueltos: () => promesa } })
    fireEvent.click(screen.getByRole('button', { name: 'Bajar team Farmeo' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Bajar team Principal' })).toBeDisabled()
    )
    expect(screen.getByRole('button', { name: 'Bajar grupo Buildeado' })).toBeDisabled()
    const datos = datosBase()
    resolver({ ok: true, teams: datos.teams, grupos: datos.grupos })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Bajar team Principal' })).toBeEnabled()
    )
  })

  it('con conflicto muestra el mensaje y recarga', async () => {
    const api = await montar(datosBase(), {
      grupos: { ordenarTeams: async () => ({ ok: false, error: 'conflicto' }) }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bajar team Principal' }))
    expect(
      await within(region('Buildeado')).findByText('No se pudo guardar por un conflicto, intentá de nuevo')
    ).toBeInTheDocument()
    await waitFor(() => expect(api.teams.listar).toHaveBeenCalledTimes(2))
  })
})
