// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RESUMEN_DE_IRISALIS } from '../../../../../tests/fixtures/apiFalsa'
import type { ResumenDeAniimo } from '../../../../shared/teams'
import type { CargarImagenDeTarjeta } from '../teams/useImagenDeTarjeta'
import CartaAniimo from './CartaAniimo'

afterEach(cleanup)

const TEAM_ID = '00000000-0000-4000-8000-000000000001'
const IMAGEN = 'data:image/png;base64,AAAA'

const CON_IMAGEN: ResumenDeAniimo = { ...RESUMEN_DE_IRISALIS, tieneImagen: true }
const DEMOFLAMA: ResumenDeAniimo = {
  ...RESUMEN_DE_IRISALIS,
  nombre: 'Demoflama',
  elemento: 'fuego',
  rol: 'dps',
  nivel: 55,
  cp: 2100
}

function cargadorDeImagen() {
  return vi.fn<CargarImagenDeTarjeta>(async () => ({ ok: true, imagen: IMAGEN }))
}

describe('carta con imagen', () => {
  it('muestra la imagen del usuario con texto alternativo, el nombre, el nivel y el CP', async () => {
    const cargar = cargadorDeImagen()
    render(<CartaAniimo teamId={TEAM_ID} slot={1} aniimo={CON_IMAGEN} variante="mazo" cargarImagen={cargar} />)
    const imagen = await screen.findByRole('img', { name: /Irisalis/ })
    expect(imagen).toHaveAttribute('src', IMAGEN)
    expect(screen.getByText('Irisalis')).toBeInTheDocument()
    expect(screen.getByText('Nv 60')).toBeInTheDocument()
    expect(screen.getByText('CP 3475')).toBeInTheDocument()
    expect(screen.getByText('Estrella 2')).toBeInTheDocument()
    expect(cargar).toHaveBeenCalledWith(TEAM_ID, 1)
  })

  it('otro Aniimo con otros datos muestra los suyos', async () => {
    render(
      <CartaAniimo
        teamId={TEAM_ID}
        slot={3}
        aniimo={{ ...DEMOFLAMA, tieneImagen: true }}
        variante="team"
        cargarImagen={cargadorDeImagen()}
      />
    )
    expect(await screen.findByRole('img', { name: /Demoflama/ })).toBeInTheDocument()
    expect(screen.getByText('Nv 55')).toBeInTheDocument()
    expect(screen.getByText('CP 2100')).toBeInTheDocument()
  })

  it('la variante se refleja en la clase de la carta', () => {
    const { container } = render(
      <CartaAniimo teamId={TEAM_ID} slot={1} aniimo={DEMOFLAMA} variante="ficha" />
    )
    expect(container.querySelector('.carta--ficha')).not.toBeNull()
    expect(container.querySelector('.carta--mazo')).toBeNull()
  })
})

describe('carta sin imagen', () => {
  it('no tiene img, no pide la imagen y muestra la inicial oculta para lectores de pantalla', () => {
    const cargar = cargadorDeImagen()
    const { container } = render(
      <CartaAniimo teamId={TEAM_ID} slot={2} aniimo={DEMOFLAMA} variante="mazo" cargarImagen={cargar} />
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(cargar).not.toHaveBeenCalled()
    const inicial = screen.getByText('D')
    expect(inicial).toHaveAttribute('aria-hidden', 'true')
  })

  it('usa el relleno del elemento cuando se conoce y el neutro cuando no', () => {
    const { container, rerender } = render(
      <CartaAniimo teamId={TEAM_ID} slot={2} aniimo={DEMOFLAMA} variante="mazo" />
    )
    expect(container.querySelector('.carta__arte--fuego')).not.toBeNull()
    rerender(
      <CartaAniimo
        teamId={TEAM_ID}
        slot={2}
        aniimo={{ ...DEMOFLAMA, elemento: null }}
        variante="mazo"
      />
    )
    expect(container.querySelector('.carta__arte--fuego')).toBeNull()
    expect(container.querySelector('.carta__arte--neutro')).not.toBeNull()
  })

  it('las formas decorativas son SVG aria-hidden', () => {
    const { container } = render(
      <CartaAniimo teamId={TEAM_ID} slot={2} aniimo={DEMOFLAMA} variante="mazo" />
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('elemento y rol en la placa', () => {
  it('con elemento y rol los muestra separados por un punto medio', () => {
    render(<CartaAniimo teamId={TEAM_ID} slot={1} aniimo={DEMOFLAMA} variante="mazo" />)
    expect(screen.getByText('Fuego · DPS')).toBeInTheDocument()
  })

  it('con elemento ausente y rol presente muestra solo el rol', () => {
    render(
      <CartaAniimo
        teamId={TEAM_ID}
        slot={1}
        aniimo={{ ...DEMOFLAMA, elemento: null }}
        variante="mazo"
      />
    )
    expect(screen.getByText('DPS')).toBeInTheDocument()
    expect(screen.queryByText(/·/)).toBeNull()
  })

  it('con elemento y rol ausentes no deja texto vacio ni separador suelto', () => {
    const { container } = render(
      <CartaAniimo
        teamId={TEAM_ID}
        slot={1}
        aniimo={{ ...DEMOFLAMA, elemento: null, rol: null }}
        variante="mazo"
      />
    )
    expect(container.querySelector('.carta__tipo')).toBeNull()
    expect(container.textContent).not.toContain('·')
    expect(screen.getByText('CP 2100')).toBeInTheDocument()
    expect(screen.getByText('Estrella 2')).toBeInTheDocument()
  })
})

describe('marca de portada', () => {
  it('muestra Portada solo cuando se pide', () => {
    const { rerender } = render(
      <CartaAniimo teamId={TEAM_ID} slot={1} aniimo={DEMOFLAMA} variante="team" esPortada />
    )
    expect(screen.getByText('Portada')).toBeInTheDocument()
    rerender(<CartaAniimo teamId={TEAM_ID} slot={1} aniimo={DEMOFLAMA} variante="team" />)
    expect(screen.queryByText('Portada')).toBeNull()
  })
})

describe('sin estilos inline en la carta', () => {
  it('ningun elemento tiene atributo style, con imagen y sin imagen', async () => {
    const { container } = render(
      <>
        <CartaAniimo
          teamId={TEAM_ID}
          slot={1}
          aniimo={CON_IMAGEN}
          variante="mazo"
          cargarImagen={cargadorDeImagen()}
        />
        <CartaAniimo teamId={TEAM_ID} slot={2} aniimo={DEMOFLAMA} variante="mazo" />
      </>
    )
    await screen.findByRole('img', { name: /Irisalis/ })
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })
})
