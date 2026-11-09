// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { armarGrupo, teamDePrueba } from '../../../../../tests/fixtures/apiFalsa'
import GrupoEnAbanico from './GrupoEnAbanico'
import { useAbanicos } from './useAbanicos'
import { useTeclasDelAbanico } from './useTeclasDelAbanico'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const BUILDEADO = armarGrupo('Buildeado', 1, [1, 2, 3, 4, 5].map((n) => teamDePrueba(`B${n}`, n)))
const HOMELAND = armarGrupo('Homeland', 2, [teamDePrueba('Casa', 6), teamDePrueba('Jardín', 7)])
const SOLO = armarGrupo('Solo', 3, [teamDePrueba('Único', 8)])
const GRUPOS = [BUILDEADO, HOMELAND, SOLO]

interface VistaProps {
  readonly alAbrirTeam?: (teamId: string) => void
  readonly activo?: boolean
  readonly confirmacion?: boolean
}

function Vista({ alAbrirTeam = () => undefined, activo = true, confirmacion = false }: VistaProps) {
  const abanicos = useAbanicos()
  useTeclasDelAbanico({
    activo,
    abanicos,
    teamIdsDe: (grupoId) => GRUPOS.find((g) => g.grupo.id === grupoId)?.grupo.teamIds ?? [],
    alAbrirTeam
  })
  return (
    <>
      <button type="button">Nuevo team</button>
      <input aria-label="Nombre del grupo" />
      <textarea aria-label="Notas" />
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
        />
      ))}
      {confirmacion && <div role="alertdialog">¿Borrar?</div>}
    </>
  )
}

function seccion(nombre: string): HTMLElement {
  return screen.getByRole('region', { name: `Grupo ${nombre}` })
}

function botonDelGrupo(nombre: string): HTMLElement {
  return within(seccion(nombre)).getByRole('button', { name: new RegExp(`^${nombre} `) })
}

function desplegado(nombre: string): boolean {
  return botonDelGrupo(nombre).getAttribute('aria-expanded') === 'true'
}

function teclear(tecla: string, opciones: KeyboardEventInit = {}): void {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: tecla, ...opciones })
}

describe('teclado del abanico', () => {
  it('T con el foco en un grupo lo despliega y otra T lo pliega', () => {
    render(<Vista />)
    botonDelGrupo('Buildeado').focus()
    teclear('t')
    expect(desplegado('Buildeado')).toBe(true)
    teclear('T')
    expect(desplegado('Buildeado')).toBe(false)
  })

  it('T con el foco fuera de un grupo despliega el que esta bajo el puntero', () => {
    render(<Vista />)
    screen.getByRole('button', { name: 'Nuevo team' }).focus()
    fireEvent.pointerEnter(seccion('Homeland'))
    teclear('t')
    fireEvent.pointerLeave(seccion('Homeland'))
    expect(desplegado('Homeland')).toBe(true)
    expect(desplegado('Buildeado')).toBe(false)
  })

  it('si el foco esta en un grupo y el puntero en otro, gana el del foco', () => {
    render(<Vista />)
    botonDelGrupo('Buildeado').focus()
    fireEvent.pointerEnter(seccion('Homeland'))
    teclear('t')
    expect(desplegado('Buildeado')).toBe(true)
    expect(desplegado('Homeland')).toBe(false)
  })

  it('T sin grupo con foco ni puntero no hace nada', () => {
    render(<Vista />)
    screen.getByRole('button', { name: 'Nuevo team' }).focus()
    teclear('t')
    expect(desplegado('Buildeado')).toBe(false)
    expect(desplegado('Homeland')).toBe(false)
  })

  it('T en un grupo de un solo team no hace nada', () => {
    render(<Vista />)
    botonDelGrupo('Solo').focus()
    teclear('t')
    expect(desplegado('Solo')).toBe(false)
  })

  it('un numero abre el team que ocupa esa posicion del grupo desplegado', () => {
    const alAbrirTeam = vi.fn()
    render(<Vista alAbrirTeam={alAbrirTeam} />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    teclear('3')
    expect(alAbrirTeam).toHaveBeenCalledWith(BUILDEADO.grupo.teamIds[2])
    teclear('5')
    expect(alAbrirTeam).toHaveBeenLastCalledWith(BUILDEADO.grupo.teamIds[4])
  })

  it('un numero mayor que la cantidad de teams no hace nada y el abanico sigue abierto', () => {
    const alAbrirTeam = vi.fn()
    render(<Vista alAbrirTeam={alAbrirTeam} />)
    fireEvent.click(botonDelGrupo('Homeland'))
    teclear('4')
    expect(alAbrirTeam).not.toHaveBeenCalled()
    expect(desplegado('Homeland')).toBe(true)
  })

  it('un numero sin ningun grupo desplegado no hace nada', () => {
    const alAbrirTeam = vi.fn()
    render(<Vista alAbrirTeam={alAbrirTeam} />)
    teclear('1')
    expect(alAbrirTeam).not.toHaveBeenCalled()
  })

  it('Esc pliega el grupo y deja el foco en su boton', () => {
    render(<Vista />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    screen.getByRole('button', { name: 'Nuevo team' }).focus()
    teclear('Escape')
    expect(desplegado('Buildeado')).toBe(false)
    expect(document.activeElement).toBe(botonDelGrupo('Buildeado'))
  })

  it('Esc sin nada desplegado no mueve el foco', () => {
    render(<Vista />)
    const nuevo = screen.getByRole('button', { name: 'Nuevo team' })
    nuevo.focus()
    teclear('Escape')
    expect(document.activeElement).toBe(nuevo)
  })
})

describe('teclas ignoradas', () => {
  it.each([
    ['un input', () => screen.getByLabelText('Nombre del grupo')],
    ['un textarea', () => screen.getByLabelText('Notas')]
  ])('en %s no despliega ni abre nada', (_nombre, campo) => {
    const alAbrirTeam = vi.fn()
    render(<Vista alAbrirTeam={alAbrirTeam} />)
    fireEvent.click(botonDelGrupo('Homeland'))
    const elemento = campo()
    elemento.focus()
    for (const tecla of ['T', 't', '1', '2', 'Escape']) {
      fireEvent.keyDown(elemento, { key: tecla })
    }
    expect(alAbrirTeam).not.toHaveBeenCalled()
    expect(desplegado('Homeland')).toBe(true)
    expect(desplegado('Buildeado')).toBe(false)
  })

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Alt', { altKey: true }],
    ['Meta', { metaKey: true }],
    ['repeticion', { repeat: true }]
  ])('con %s no despliega', (_nombre, opciones) => {
    render(<Vista />)
    botonDelGrupo('Buildeado').focus()
    teclear('t', opciones)
    expect(desplegado('Buildeado')).toBe(false)
  })

  it('con un modificador un numero no abre el team', () => {
    const alAbrirTeam = vi.fn()
    render(<Vista alAbrirTeam={alAbrirTeam} />)
    fireEvent.click(botonDelGrupo('Buildeado'))
    teclear('2', { ctrlKey: true })
    expect(alAbrirTeam).not.toHaveBeenCalled()
  })

  it('con una confirmacion abierta no despliega', () => {
    render(<Vista confirmacion />)
    botonDelGrupo('Buildeado').focus()
    teclear('t')
    expect(desplegado('Buildeado')).toBe(false)
  })

  it('en modo Organizar (inactivo) no despliega ni abre nada', () => {
    const alAbrirTeam = vi.fn()
    render(<Vista activo={false} alAbrirTeam={alAbrirTeam} />)
    botonDelGrupo('Buildeado').focus()
    teclear('t')
    fireEvent.click(botonDelGrupo('Buildeado'))
    teclear('2')
    expect(alAbrirTeam).not.toHaveBeenCalled()
  })
})

describe('listener de ventana', () => {
  it('se quita al salir de la vista y despues las teclas no hacen nada', () => {
    const alAbrirTeam = vi.fn()
    const quitar = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Vista alAbrirTeam={alAbrirTeam} />)
    unmount()
    expect(quitar.mock.calls.filter(([tipo]) => tipo === 'keydown')).toHaveLength(1)
    fireEvent.keyDown(document.body, { key: '1' })
    expect(alAbrirTeam).not.toHaveBeenCalled()
  })

  it('se escucha en window y no en el documento', () => {
    const agregar = vi.spyOn(window, 'addEventListener')
    render(<Vista />)
    expect(agregar.mock.calls.some(([tipo]) => tipo === 'keydown')).toBe(true)
  })
})
