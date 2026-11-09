// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  armarGrupo,
  RESUMEN_DE_IRISALIS,
  teamDePrueba
} from '../../../../../tests/fixtures/apiFalsa'
import GrupoEnAbanico from './GrupoEnAbanico'
import { useAbanicos } from './useAbanicos'

afterEach(cleanup)

const PRINCIPAL = teamDePrueba('Principal', 1, { 1: RESUMEN_DE_IRISALIS })
const RAID = teamDePrueba('Raid', 2)
const JEFES = teamDePrueba('Jefes', 3, {}, true)
const TORRE = teamDePrueba('Torre', 4)
const PVP = teamDePrueba('PvP', 5)
const CASA = teamDePrueba('Casa', 6)
const JARDIN = teamDePrueba('Jardín', 7)
const SOLO = teamDePrueba('Único', 8)

const BUILDEADO = armarGrupo('Buildeado', 1, [PRINCIPAL, RAID, JEFES, TORRE, PVP])
const HOMELAND = armarGrupo('Homeland', 2, [CASA, JARDIN])
const UNICO = armarGrupo('Solo', 3, [SOLO])

function Mazo({
  grupos,
  alAbrirTeam = () => undefined
}: {
  readonly grupos: readonly (typeof BUILDEADO)[]
  readonly alAbrirTeam?: (teamId: string) => void
}) {
  const abanicos = useAbanicos()
  return (
    <>
      {grupos.map(({ grupo, teams }) => (
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
        />
      ))}
    </>
  )
}

function seccion(nombre: string): HTMLElement {
  return screen.getByRole('region', { name: `Grupo ${nombre}` })
}

function botonDelGrupo(nombre: string): HTMLElement {
  return within(seccion(nombre)).getByRole('button', { name: new RegExp(`^${nombre} `) })
}

describe('grupo en abanico', () => {
  it('cerrado solo la pila de la portada es accesible y focusable', () => {
    render(<Mazo grupos={[BUILDEADO]} />)
    const accesibles = within(seccion('Buildeado')).getAllByRole('button', { name: /^Team / })
    expect(accesibles).toHaveLength(1)
    expect(accesibles[0]).toHaveAccessibleName('Team Principal, 1 de 4 Aniimo')
    const tapados = seccion('Buildeado').querySelectorAll('.pila[aria-hidden="true"]')
    expect(tapados).toHaveLength(4)
    for (const tapado of tapados) {
      expect(tapado.getAttribute('tabindex')).toBe('-1')
    }
    const boton = botonDelGrupo('Buildeado')
    expect(boton).toHaveTextContent('5 teams · portada «Principal»')
    expect(boton).toHaveAttribute('aria-expanded', 'false')
  })

  it('el boton despliega el abanico con los cinco teams numerados y enfocables', () => {
    render(<Mazo grupos={[BUILDEADO]} />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    expect(botonDelGrupo('Buildeado')).toHaveAttribute('aria-expanded', 'true')
    const numeros = Array.from(seccion('Buildeado').querySelectorAll('.pila__numero')).map(
      (n) => n.textContent
    )
    expect(numeros).toEqual(['1', '2', '3', '4', '5'])
    const pilas = within(seccion('Buildeado')).getAllByRole('button', { name: /^\d: Team / })
    expect(pilas).toHaveLength(5)
    expect(pilas[1]).toHaveAccessibleName('2: Team Raid, 0 de 4 Aniimo')
    for (const pila of pilas) {
      expect(pila.getAttribute('tabindex')).not.toBe('-1')
    }
  })

  it('activar el boton otra vez lo pliega', () => {
    render(<Mazo grupos={[BUILDEADO]} />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    fireEvent.click(botonDelGrupo('Buildeado'))
    expect(botonDelGrupo('Buildeado')).toHaveAttribute('aria-expanded', 'false')
  })

  it('con el puntero se despliega al entrar y se pliega al salir', () => {
    render(<Mazo grupos={[BUILDEADO, HOMELAND]} />)
    fireEvent.pointerEnter(seccion('Homeland'))
    expect(botonDelGrupo('Homeland')).toHaveAttribute('aria-expanded', 'true')
    expect(botonDelGrupo('Buildeado')).toHaveAttribute('aria-expanded', 'false')
    fireEvent.pointerLeave(seccion('Homeland'))
    expect(botonDelGrupo('Homeland')).toHaveAttribute('aria-expanded', 'false')
  })

  it('un grupo desplegado con el boton no se pliega al sacar el puntero', () => {
    render(<Mazo grupos={[BUILDEADO]} />)
    fireEvent.pointerEnter(seccion('Buildeado'))
    fireEvent.click(botonDelGrupo('Buildeado'))
    fireEvent.pointerLeave(seccion('Buildeado'))
    expect(botonDelGrupo('Buildeado')).toHaveAttribute('aria-expanded', 'true')
  })

  it('solo un grupo esta desplegado a la vez', () => {
    render(<Mazo grupos={[BUILDEADO, HOMELAND]} />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    fireEvent.click(botonDelGrupo('Homeland'))
    expect(botonDelGrupo('Homeland')).toHaveAttribute('aria-expanded', 'true')
    expect(botonDelGrupo('Buildeado')).toHaveAttribute('aria-expanded', 'false')
  })

  it('la grilla no se mueve: usa clases de posicion por cantidad y sin style', () => {
    const { container } = render(<Mazo grupos={[BUILDEADO, HOMELAND]} />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    const abanico = seccion('Buildeado').querySelector('.abanico')
    expect(abanico).toHaveClass('abanico--n5', 'abanico--abierto')
    const posiciones = Array.from(abanico!.querySelectorAll('.pila')).map((p) =>
      Array.from(p.classList).find((c) => c.startsWith('abanico__team--'))
    )
    expect(posiciones).toEqual([
      'abanico__team--p0',
      'abanico__team--p1',
      'abanico__team--p2',
      'abanico__team--p3',
      'abanico__team--p4'
    ])
    expect(seccion('Homeland').querySelector('.abanico')).toHaveClass('abanico--n2')
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })

  it('un grupo con un solo team no se despliega', () => {
    render(<Mazo grupos={[UNICO]} />)
    fireEvent.click(botonDelGrupo('Solo'))
    expect(botonDelGrupo('Solo')).toHaveAttribute('aria-expanded', 'false')
    expect(seccion('Solo').querySelector('.abanico')).not.toHaveClass('abanico--abierto')
    expect(botonDelGrupo('Solo')).toHaveTextContent('1 team · portada «Único»')
  })

  it('activar la pila de un team avisa con su id', () => {
    const alAbrirTeam = vi.fn()
    render(<Mazo grupos={[BUILDEADO]} alAbrirTeam={alAbrirTeam} />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    fireEvent.click(screen.getByRole('button', { name: /^3: Team Jefes/ }))
    expect(alAbrirTeam).toHaveBeenCalledWith(JEFES.id)
  })

  it('un team oculto muestra una sola marca de texto', () => {
    render(<Mazo grupos={[BUILDEADO]} />)
    expect(within(seccion('Buildeado')).getAllByText('Oculto para amigos')).toHaveLength(1)
  })
})
