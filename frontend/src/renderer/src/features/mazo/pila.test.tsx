// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESUMEN_DE_IRISALIS } from '../../../../../tests/fixtures/apiFalsa'
import type { ResumenDeAniimo, SlotDeTeam } from '../../../../shared/teams'
import type { CargarImagenDeTarjeta } from '../teams/useImagenDeTarjeta'
import PilaDeTeam from './PilaDeTeam'

afterEach(cleanup)

const TEAM_ID = '00000000-0000-4000-8000-000000000001'

function aniimo(nombre: string, cambios: Partial<ResumenDeAniimo> = {}): ResumenDeAniimo {
  return { ...RESUMEN_DE_IRISALIS, nombre, ...cambios }
}

function slots(nombres: readonly (string | null)[], cambios: Partial<ResumenDeAniimo> = {}): SlotDeTeam[] {
  return [1, 2, 3, 4].map((slot) => {
    const nombre = nombres[slot - 1]
    return { slot, aniimo: nombre === undefined || nombre === null ? null : aniimo(nombre, cambios) }
  })
}

function renderPila(
  nombre: string,
  ocupados: readonly (string | null)[],
  props: {
    portadaSlot?: number | null
    ocultoParaAmigos?: boolean
    conImagen?: boolean
    alAbrir?: () => void
    cargarImagen?: CargarImagenDeTarjeta
  } = {}
) {
  return render(
    <PilaDeTeam
      teamId={TEAM_ID}
      nombre={nombre}
      slots={slots(ocupados, { tieneImagen: props.conImagen ?? false })}
      portadaSlot={props.portadaSlot ?? null}
      ocultoParaAmigos={props.ocultoParaAmigos ?? false}
      alAbrir={props.alAbrir ?? (() => undefined)}
      {...(props.cargarImagen === undefined ? {} : { cargarImagen: props.cargarImagen })}
    />
  )
}

describe('pila con portada elegida', () => {
  it('muestra la carta de la portada, tres bordes detras, el nombre y 4/4', async () => {
    const cargar = vi.fn<CargarImagenDeTarjeta>(async () => ({
      ok: true,
      imagen: 'data:image/png;base64,AAAA'
    }))
    const { container } = renderPila('Torre', ['Luz', 'Flama', 'Demoflama', 'Volt'], {
      portadaSlot: 3,
      conImagen: true,
      cargarImagen: cargar
    })
    await screen.findByRole('img', { name: /Demoflama/ })
    expect(cargar).toHaveBeenCalledTimes(1)
    expect(cargar).toHaveBeenCalledWith(TEAM_ID, 3)
    const bordes = container.querySelectorAll('.pila__capa')
    expect(bordes).toHaveLength(3)
    bordes.forEach((borde) => expect(borde).toHaveAttribute('aria-hidden', 'true'))
    expect(screen.getByText('Torre')).toBeInTheDocument()
    expect(screen.getByText('4/4')).toBeInTheDocument()
  })

  it('la carta visible es la de la portada y no la del primer slot', () => {
    renderPila('Torre', ['Luz', 'Flama', 'Demoflama', 'Volt'], { portadaSlot: 3 })
    expect(screen.getByText('Demoflama')).toBeInTheDocument()
    expect(screen.queryByText('Luz')).toBeNull()
  })
})

describe('nombre accesible', () => {
  it('es un unico control con el nombre del team y la cantidad de Aniimo', () => {
    renderPila('Principal', ['A', 'B', 'C'])
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Team Principal, 3 de 4 Aniimo' })).toBeInTheDocument()
  })

  it('con otro team y otra cantidad cambia el nombre', () => {
    renderPila('Jefes', ['A'])
    expect(screen.getByRole('button', { name: 'Team Jefes, 1 de 4 Aniimo' })).toBeInTheDocument()
  })

  it('activar la pila llama a alAbrir', () => {
    const alAbrir = vi.fn()
    renderPila('Principal', ['A', 'B'], { alAbrir })
    fireEvent.click(screen.getByRole('button'))
    expect(alAbrir).toHaveBeenCalledTimes(1)
  })
})

describe('team vacio', () => {
  it('muestra la invitacion y 0/4 sin bordes', () => {
    const { container } = renderPila('Nuevo', [])
    expect(screen.getByText('Team vacío. Agregá tu primer Aniimo.')).toBeInTheDocument()
    expect(screen.getByText('0/4')).toBeInTheDocument()
    expect(container.querySelectorAll('.pila__capa')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Team Nuevo, 0 de 4 Aniimo' })).toBeInTheDocument()
  })
})

describe('cantidad de bordes y portada automatica', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3]
  ])('con %i Aniimo hay %i bordes', (cantidad, bordes) => {
    const { container } = renderPila(
      'Team',
      ['A', 'B', 'C', 'D'].slice(0, cantidad)
    )
    expect(container.querySelectorAll('.pila__capa')).toHaveLength(bordes)
    expect(screen.getByText(`${cantidad}/4`)).toBeInTheDocument()
  })

  it('sin portada elegida muestra el primer Aniimo cargado', () => {
    renderPila('Team', [null, 'Segundo', 'Tercero'], { portadaSlot: null })
    expect(screen.getByText('Segundo')).toBeInTheDocument()
    expect(screen.queryByText('Tercero')).toBeNull()
  })

  it('una portada que apunta a un slot vacio cae al primer Aniimo cargado', () => {
    renderPila('Team', ['Primero', null, 'Tercero'], { portadaSlot: 2 })
    expect(screen.getByText('Primero')).toBeInTheDocument()
  })

  it('con imagenes en varios slots solo pide la de la portada automatica', () => {
    const cargar = vi.fn<CargarImagenDeTarjeta>(async () => ({ ok: true, imagen: null }))
    renderPila('Team', ['A', 'B', 'C'], { conImagen: true, cargarImagen: cargar })
    expect(cargar).toHaveBeenCalledTimes(1)
    expect(cargar).toHaveBeenCalledWith(TEAM_ID, 1)
  })
})

describe('marca de team oculto', () => {
  it('un team oculto lleva una sola marca Oculto para amigos', () => {
    renderPila('Jefes', ['A', 'B'], { ocultoParaAmigos: true })
    expect(screen.getAllByText('Oculto para amigos')).toHaveLength(1)
  })

  it('un team visible no lleva la marca', () => {
    renderPila('Jefes', ['A', 'B'])
    expect(screen.queryByText('Oculto para amigos')).toBeNull()
  })
})

describe('sin estilos inline en la pila', () => {
  it('ni llena ni vacia tienen atributo style', () => {
    const llena = renderPila('Principal', ['A', 'B', 'C', 'D'], { ocultoParaAmigos: true })
    expect(llena.container.querySelectorAll('[style]')).toHaveLength(0)
    cleanup()
    const vacia = renderPila('Nuevo', [])
    expect(vacia.container.querySelectorAll('[style]')).toHaveLength(0)
  })
})
