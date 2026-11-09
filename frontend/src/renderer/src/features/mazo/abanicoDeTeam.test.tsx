// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESUMEN_DE_IRISALIS, armarGrupo, teamDePrueba } from '../../../../../tests/fixtures/apiFalsa'
import type { TeamResumen } from '../../../../shared/teams'
import GrupoEnAbanico from './GrupoEnAbanico'
import PilaDeTeam from './PilaDeTeam'
import { useAbanicos } from './useAbanicos'
import { useTeclasDelAbanico } from './useTeclasDelAbanico'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function conSlots(team: TeamResumen, llenos: number): TeamResumen {
  return {
    ...team,
    slots: team.slots.map((s, i) => ({ slot: s.slot, aniimo: i < llenos ? RESUMEN_DE_IRISALIS : null }))
  }
}

const RAID = conSlots(teamDePrueba('Raid', 1), 4)
const MITAD = conSlots(teamDePrueba('Mitad', 2), 2)
const CASA = teamDePrueba('Casa', 3)
const JARDIN = teamDePrueba('Jardín', 4)
const UNICO = teamDePrueba('Único', 5)
const HOMELAND = armarGrupo('Homeland', 1, [CASA, JARDIN])
const SOLO = armarGrupo('Solo', 2, [UNICO])
const GRUPOS = [HOMELAND, SOLO]
const SUELTOS = [RAID, MITAD]

function Vista({ alAbrirTeam = () => undefined }: { alAbrirTeam?: (id: string) => void }) {
  const abanicos = useAbanicos()
  useTeclasDelAbanico({
    activo: true,
    abanicos,
    teamIdsDe: (grupoId) => GRUPOS.find((g) => g.grupo.id === grupoId)?.grupo.teamIds ?? [],
    alAbrirTeam
  })
  return (
    <>
      {GRUPOS.map(({ grupo, teams }) => (
        <GrupoEnAbanico
          key={grupo.id}
          grupoId={grupo.id}
          nombre={grupo.nombre}
          teams={teams}
          portadaTeamId={grupo.portadaEfectivaTeamId}
          abierto={abanicos.estaAbierto(grupo.id)}
          alAlternar={() => abanicos.alternar(grupo.id)}
          alEntrar={() => abanicos.entrar(grupo.id)}
          alSalir={() => abanicos.salir(grupo.id)}
          alAbrirTeam={alAbrirTeam}
          teamDesplegado={abanicos.teamAbierto}
          alEntrarTeam={abanicos.entrarTeam}
          alSalirTeam={abanicos.salirTeam}
        />
      ))}
      {SUELTOS.map((team) => (
        <PilaDeTeam
          key={team.id}
          teamId={team.id}
          nombre={team.nombre}
          slots={team.slots}
          portadaSlot={team.portadaEfectivaSlot}
          ocultoParaAmigos={false}
          alAbrir={() => alAbrirTeam(team.id)}
          desplegada={abanicos.teamAbierto === team.id}
          alEntrar={() => abanicos.entrarTeam(team.id)}
          alSalir={() => abanicos.salirTeam(team.id)}
        />
      ))}
    </>
  )
}

function pila(nombre: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`Team ${nombre},`) })
}

function cartasFlotantes(): number {
  return document.querySelectorAll('.pila__flotante').length
}

function vacias(): number {
  return screen.queryAllByText('Vacío').length
}

function tecla(nombre: string): void {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: nombre })
}

describe('abanico de cartas de un team con el puntero', () => {
  it('un team suelto con 4 Aniimo abre 4 cartas y las pliega al salir', () => {
    render(<Vista />)
    expect(cartasFlotantes()).toBe(0)
    fireEvent.pointerEnter(pila('Raid'))
    expect(cartasFlotantes()).toBe(4)
    expect(vacias()).toBe(0)
    fireEvent.pointerLeave(pila('Raid'))
    expect(cartasFlotantes()).toBe(0)
  })

  it('un team con 2 Aniimo abre 2 cartas y 2 tenues "Vacío"', () => {
    render(<Vista />)
    fireEvent.pointerEnter(pila('Mitad'))
    expect(cartasFlotantes()).toBe(4)
    expect(vacias()).toBe(2)
  })

  it('las cartas flotantes son decorativas y no llevan estilos inline', () => {
    render(<Vista />)
    fireEvent.pointerEnter(pila('Raid'))
    const abanico = document.querySelector('.pila__abanico')!
    expect(abanico).toHaveAttribute('aria-hidden', 'true')
    expect(abanico.querySelector('[style]')).toBeNull()
    expect(pila('Raid').className).toContain('pila--desplegada')
  })

  it('solo se abre un team a la vez', () => {
    render(<Vista />)
    fireEvent.pointerEnter(pila('Raid'))
    fireEvent.pointerLeave(pila('Raid'))
    fireEvent.pointerEnter(pila('Mitad'))
    expect(vacias()).toBe(2)
    expect(cartasFlotantes()).toBe(4)
  })

  it('un team dentro de un grupo desplegado abre sus cartas y el grupo sigue abierto', () => {
    render(<Vista />)
    const seccion = screen.getByRole('region', { name: 'Grupo Homeland' })
    fireEvent.pointerEnter(seccion)
    fireEvent.pointerEnter(within(seccion).getByRole('button', { name: /Team Jardín,/ }))
    expect(cartasFlotantes()).toBe(4)
    expect(within(seccion).getByRole('button', { name: /^Homeland / })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('el unico team de un grupo de uno abre sus cartas', () => {
    render(<Vista />)
    fireEvent.pointerEnter(pila('Único'))
    expect(cartasFlotantes()).toBe(4)
  })

  it('hacer clic en la pila sigue abriendo el team', () => {
    const alAbrirTeam = vi.fn()
    render(<Vista alAbrirTeam={alAbrirTeam} />)
    fireEvent.pointerEnter(pila('Raid'))
    fireEvent.click(pila('Raid'))
    expect(alAbrirTeam).toHaveBeenCalledWith(RAID.id)
  })
})

describe('abanico de cartas de un team con el teclado', () => {
  it('T con el foco en un team suelto abre las cartas y Esc las pliega con el foco en la pila', () => {
    render(<Vista />)
    pila('Raid').focus()
    tecla('t')
    expect(cartasFlotantes()).toBe(4)
    tecla('Escape')
    expect(cartasFlotantes()).toBe(0)
    expect(pila('Raid')).toHaveFocus()
  })

  it('otra T cierra las cartas', () => {
    render(<Vista />)
    pila('Mitad').focus()
    tecla('T')
    tecla('T')
    expect(cartasFlotantes()).toBe(0)
  })

  it('T sobre la portada de un grupo cerrado de varios teams despliega el grupo y no las cartas', () => {
    render(<Vista />)
    const seccion = screen.getByRole('region', { name: 'Grupo Homeland' })
    within(seccion).getByRole('button', { name: /Team Casa,/ }).focus()
    tecla('t')
    expect(cartasFlotantes()).toBe(0)
    expect(within(seccion).getByRole('button', { name: /^Homeland / })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('con el grupo desplegado, T sobre el team con foco abre sus cartas y Esc cierra primero el team', () => {
    render(<Vista />)
    const seccion = screen.getByRole('region', { name: 'Grupo Homeland' })
    const boton = within(seccion).getByRole('button', { name: /^Homeland / })
    fireEvent.click(boton)
    within(seccion).getByRole('button', { name: /Team Jardín,/ }).focus()
    tecla('t')
    expect(cartasFlotantes()).toBe(4)
    tecla('Escape')
    expect(cartasFlotantes()).toBe(0)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    tecla('Escape')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
  })

  it('T sobre el unico team de un grupo de uno abre sus cartas', () => {
    render(<Vista />)
    pila('Único').focus()
    tecla('t')
    expect(cartasFlotantes()).toBe(4)
  })

  it('T con el puntero sobre un team suelto y el foco fuera abre ese team', () => {
    render(<Vista />)
    document.body.focus()
    fireEvent.pointerEnter(pila('Mitad'))
    tecla('t')
    expect(vacias()).toBe(2)
  })
})
