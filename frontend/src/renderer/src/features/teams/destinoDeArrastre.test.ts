import { describe, expect, it } from 'vitest'
import { armarGrupo, teamDePrueba } from '../../../../../tests/fixtures/apiFalsa'
import { destinoDeMovimiento, destinoDeSoltar } from './destinoDeArrastre'
import { armarSecciones } from './secciones'

const PRINCIPAL = teamDePrueba('Principal', 1)
const RAID = teamDePrueba('Raid', 2)
const JEFES = teamDePrueba('Jefes', 3)
const FARMEO = teamDePrueba('Farmeo', 4)
const EVENTOS = teamDePrueba('Eventos', 5)
const HIELO = teamDePrueba('Hielo', 6)
const CASA = teamDePrueba('Casa', 7)

const BUILDEADO = armarGrupo('Buildeado', 1, [PRINCIPAL, RAID, JEFES])
const EN_PROCESO = armarGrupo('En proceso', 2, [HIELO])
const HOMELAND = armarGrupo('Homeland', 3, [CASA])

function secciones() {
  return armarSecciones(
    [...BUILDEADO.teams, ...EN_PROCESO.teams, ...HOMELAND.teams, FARMEO, EVENTOS],
    [HOMELAND.grupo, BUILDEADO.grupo, EN_PROCESO.grupo]
  )
}

function seccionesConGrupoLleno() {
  const equipos = [1, 2, 3, 4, 5].map((n) => teamDePrueba(`Lleno ${n}`, 10 + n))
  const lleno = armarGrupo('Lleno', 1, equipos)
  return armarSecciones([...lleno.teams, FARMEO, ...EN_PROCESO.teams], [lleno.grupo, EN_PROCESO.grupo])
}

describe('armarSecciones', () => {
  it('ordena grupos por orden, sus teams segun el grupo y deja los sueltos por orden', () => {
    const resultado = armarSecciones(
      [EVENTOS, ...BUILDEADO.teams, FARMEO, ...HOMELAND.teams],
      [HOMELAND.grupo, BUILDEADO.grupo]
    )
    expect(resultado.grupos.map((g) => g.grupo.nombre)).toEqual(['Buildeado', 'Homeland'])
    expect(resultado.grupos[0]?.teams.map((t) => t.nombre)).toEqual(['Principal', 'Raid', 'Jefes'])
    expect(resultado.sueltos.map((t) => t.nombre)).toEqual(['Farmeo', 'Eventos'])
  })

  it('un grupo sin teams queda con lista vacia', () => {
    const vacio = armarGrupo('Vacio', 1, [])
    const resultado = armarSecciones([FARMEO], [vacio.grupo])
    expect(resultado.grupos[0]?.teams).toEqual([])
    expect(resultado.sueltos).toHaveLength(1)
  })
})

describe('destinoDeSoltar: reordenar en el mismo ambito', () => {
  it('un grupo sobre otro queda en su lugar y corre el resto', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'grupo', id: HOMELAND.grupo.id }, { tipo: 'grupo', id: BUILDEADO.grupo.id })
    ).toEqual({
      tipo: 'ordenar-grupos',
      grupoIds: [HOMELAND.grupo.id, BUILDEADO.grupo.id, EN_PROCESO.grupo.id]
    })
  })

  it('un grupo arrastrado hacia abajo queda en la posicion del destino', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'grupo', id: BUILDEADO.grupo.id }, { tipo: 'grupo', id: HOMELAND.grupo.id })
    ).toEqual({
      tipo: 'ordenar-grupos',
      grupoIds: [EN_PROCESO.grupo.id, HOMELAND.grupo.id, BUILDEADO.grupo.id]
    })
  })

  it('un team sobre otro de su grupo reordena el grupo con la lista completa', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: JEFES.id }, { tipo: 'team', id: PRINCIPAL.id })
    ).toEqual({
      tipo: 'ordenar-teams',
      grupoId: BUILDEADO.grupo.id,
      teamIds: [JEFES.id, PRINCIPAL.id, RAID.id]
    })
  })

  it('un team suelto sobre otro suelto reordena los sueltos', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: EVENTOS.id }, { tipo: 'team', id: FARMEO.id })
    ).toEqual({ tipo: 'ordenar-sueltos', teamIds: [EVENTOS.id, FARMEO.id] })
  })

  it('soltar un elemento sobre si mismo no hace nada', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: RAID.id }, { tipo: 'team', id: RAID.id })
    ).toBeNull()
    expect(
      destinoDeSoltar(secciones(), { tipo: 'grupo', id: HOMELAND.grupo.id }, { tipo: 'grupo', id: HOMELAND.grupo.id })
    ).toBeNull()
  })
})

describe('destinoDeSoltar: mover entre ambitos', () => {
  it('un team suelto sobre la seccion de un grupo lo agrega', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: FARMEO.id }, { tipo: 'grupo', id: EN_PROCESO.grupo.id })
    ).toEqual({ tipo: 'agregar', grupoId: EN_PROCESO.grupo.id, teamId: FARMEO.id })
  })

  it('un team de un grupo sobre la seccion de otro grupo lo mueve', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: RAID.id }, { tipo: 'grupo', id: HOMELAND.grupo.id })
    ).toEqual({ tipo: 'agregar', grupoId: HOMELAND.grupo.id, teamId: RAID.id })
  })

  it('un team sobre un team de otro grupo cuenta como soltarlo en ese grupo', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: FARMEO.id }, { tipo: 'team', id: HIELO.id })
    ).toEqual({ tipo: 'agregar', grupoId: EN_PROCESO.grupo.id, teamId: FARMEO.id })
  })

  it('un team de un grupo sobre Sin grupo lo saca', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: RAID.id }, { tipo: 'sin-grupo' })
    ).toEqual({ tipo: 'sacar', grupoId: BUILDEADO.grupo.id, teamId: RAID.id })
  })

  it('un team de un grupo sobre un team suelto tambien lo saca', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: HIELO.id }, { tipo: 'team', id: FARMEO.id })
    ).toEqual({ tipo: 'sacar', grupoId: EN_PROCESO.grupo.id, teamId: HIELO.id })
  })

  it('un team suelto sobre Sin grupo no hace nada', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: FARMEO.id }, { tipo: 'sin-grupo' })
    ).toBeNull()
  })

  it('un team sobre su propio grupo no hace nada', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: RAID.id }, { tipo: 'grupo', id: BUILDEADO.grupo.id })
    ).toBeNull()
  })

  it('un grupo con cinco teams no es destino de un team de otro ambito', () => {
    const llenas = seccionesConGrupoLleno()
    const lleno = llenas.grupos[0]!.grupo.id
    expect(destinoDeSoltar(llenas, { tipo: 'team', id: FARMEO.id }, { tipo: 'grupo', id: lleno })).toBeNull()
    expect(destinoDeSoltar(llenas, { tipo: 'team', id: HIELO.id }, { tipo: 'grupo', id: lleno })).toBeNull()
  })

  it('un grupo sobre un team o sobre Sin grupo no hace nada, y un team sobre un grupo arrastrado tampoco', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'grupo', id: BUILDEADO.grupo.id }, { tipo: 'team', id: FARMEO.id })
    ).toBeNull()
    expect(
      destinoDeSoltar(secciones(), { tipo: 'grupo', id: BUILDEADO.grupo.id }, { tipo: 'sin-grupo' })
    ).toBeNull()
  })

  it('ids que no existen no producen destino', () => {
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: 'x' }, { tipo: 'grupo', id: BUILDEADO.grupo.id })
    ).toBeNull()
    expect(
      destinoDeSoltar(secciones(), { tipo: 'team', id: FARMEO.id }, { tipo: 'grupo', id: 'x' })
    ).toBeNull()
  })
})

describe('destinoDeMovimiento (Subir y Bajar)', () => {
  it('bajar un team intercambia con el siguiente de su grupo', () => {
    expect(destinoDeMovimiento(secciones(), { tipo: 'team', id: PRINCIPAL.id }, 'bajar')).toEqual({
      tipo: 'ordenar-teams',
      grupoId: BUILDEADO.grupo.id,
      teamIds: [RAID.id, PRINCIPAL.id, JEFES.id]
    })
  })

  it('subir un grupo intercambia con el anterior', () => {
    expect(destinoDeMovimiento(secciones(), { tipo: 'grupo', id: EN_PROCESO.grupo.id }, 'subir')).toEqual({
      tipo: 'ordenar-grupos',
      grupoIds: [EN_PROCESO.grupo.id, BUILDEADO.grupo.id, HOMELAND.grupo.id]
    })
  })

  it('bajar un team suelto reordena los sueltos', () => {
    expect(destinoDeMovimiento(secciones(), { tipo: 'team', id: FARMEO.id }, 'bajar')).toEqual({
      tipo: 'ordenar-sueltos',
      teamIds: [EVENTOS.id, FARMEO.id]
    })
  })

  it('no hay destino en los extremos', () => {
    expect(destinoDeMovimiento(secciones(), { tipo: 'team', id: PRINCIPAL.id }, 'subir')).toBeNull()
    expect(destinoDeMovimiento(secciones(), { tipo: 'team', id: EVENTOS.id }, 'bajar')).toBeNull()
    expect(destinoDeMovimiento(secciones(), { tipo: 'grupo', id: BUILDEADO.grupo.id }, 'subir')).toBeNull()
    expect(destinoDeMovimiento(secciones(), { tipo: 'grupo', id: HOMELAND.grupo.id }, 'bajar')).toBeNull()
  })

  it('un id inexistente no produce destino', () => {
    expect(destinoDeMovimiento(secciones(), { tipo: 'team', id: 'x' }, 'bajar')).toBeNull()
  })
})
