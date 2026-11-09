// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { instalarApi } from '../../../../../tests/fixtures/apiFalsa'
import { fichaGuardadaDeReferencia } from '../../../../../tests/fixtures/ficha'
import FichaAniimo from './FichaAniimo'

afterEach(cleanup)

const TEAM_ID = '00000000-0000-4000-8000-000000000001'
const NOMBRES = ['Generales', 'Stats', 'Entrenamiento', 'Objetos', 'Notas', 'Potencial']

async function abrirFicha(): Promise<void> {
  instalarApi({
    teams: { obtenerFicha: async () => ({ ok: true, ficha: fichaGuardadaDeReferencia() }) }
  })
  render(<FichaAniimo teamId={TEAM_ID} slot={1} alVolver={vi.fn()} alSesionVencida={vi.fn()} />)
  await screen.findByLabelText('Nombre')
}

function pestana(nombre: string): HTMLElement {
  return screen.getByRole('tab', { name: nombre })
}

describe('pestanas de la ficha', () => {
  it('ofrece las seis pestanas en un tablist con Generales activa al abrir', async () => {
    await abrirFicha()
    const lista = screen.getByRole('tablist', { name: 'Bloques de la ficha' })
    expect(within(lista).getAllByRole('tab').map((p) => p.textContent)).toEqual(NOMBRES)
    expect(pestana('Generales')).toHaveAttribute('aria-selected', 'true')
    for (const nombre of NOMBRES.slice(1)) {
      expect(pestana(nombre)).toHaveAttribute('aria-selected', 'false')
    }
  })

  it('solo el panel de la pestana activa es visible y los demas siguen montados', async () => {
    await abrirFicha()
    const visibles = screen.getAllByRole('tabpanel')
    expect(visibles).toHaveLength(1)
    expect(visibles[0]).toHaveAccessibleName('Generales')
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(6)
    expect(screen.getByLabelText('ATQ valor')).toBeInTheDocument()
  })

  it('cada pestana apunta a su panel con aria-controls y el panel a la pestana', async () => {
    await abrirFicha()
    for (const nombre of NOMBRES) {
      const id = pestana(nombre).getAttribute('aria-controls') ?? ''
      const panel = document.getElementById(id)
      expect(panel).not.toBeNull()
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel?.getAttribute('aria-labelledby')).toBe(pestana(nombre).id)
    }
  })

  it('hacer clic activa la pestana y muestra solo su panel', async () => {
    await abrirFicha()
    fireEvent.click(pestana('Stats'))
    expect(pestana('Stats')).toHaveAttribute('aria-selected', 'true')
    expect(pestana('Generales')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Stats')
  })

  it('solo la pestana activa esta en el orden de Tab', async () => {
    await abrirFicha()
    expect(pestana('Generales')).toHaveAttribute('tabindex', '0')
    for (const nombre of NOMBRES.slice(1)) {
      expect(pestana(nombre)).toHaveAttribute('tabindex', '-1')
    }
    fireEvent.click(pestana('Objetos'))
    expect(pestana('Objetos')).toHaveAttribute('tabindex', '0')
    expect(pestana('Generales')).toHaveAttribute('tabindex', '-1')
  })

  it('flecha derecha desde Potencial activa y enfoca Generales (circular)', async () => {
    await abrirFicha()
    fireEvent.click(pestana('Potencial'))
    pestana('Potencial').focus()
    fireEvent.keyDown(pestana('Potencial'), { key: 'ArrowRight' })
    expect(pestana('Generales')).toHaveAttribute('aria-selected', 'true')
    expect(pestana('Generales')).toHaveFocus()
  })

  it('flecha izquierda desde Generales va a Potencial y desde Stats vuelve a Generales', async () => {
    await abrirFicha()
    fireEvent.keyDown(pestana('Generales'), { key: 'ArrowLeft' })
    expect(pestana('Potencial')).toHaveAttribute('aria-selected', 'true')
    expect(pestana('Potencial')).toHaveFocus()
    fireEvent.click(pestana('Stats'))
    fireEvent.keyDown(pestana('Stats'), { key: 'ArrowLeft' })
    expect(pestana('Generales')).toHaveAttribute('aria-selected', 'true')
  })

  it('Fin va a la ultima pestana e Inicio a la primera', async () => {
    await abrirFicha()
    fireEvent.keyDown(pestana('Generales'), { key: 'End' })
    expect(pestana('Potencial')).toHaveAttribute('aria-selected', 'true')
    expect(pestana('Potencial')).toHaveFocus()
    fireEvent.keyDown(pestana('Potencial'), { key: 'Home' })
    expect(pestana('Generales')).toHaveAttribute('aria-selected', 'true')
    expect(pestana('Generales')).toHaveFocus()
  })

  it('otras teclas no cambian la pestana', async () => {
    await abrirFicha()
    fireEvent.keyDown(pestana('Generales'), { key: 'a' })
    expect(pestana('Generales')).toHaveAttribute('aria-selected', 'true')
  })

  it('Potencial y Despertar vive en la pestana Potencial', async () => {
    await abrirFicha()
    expect(screen.queryByRole('button', { name: 'Potencial y Despertar' })).toBeNull()
    fireEvent.click(pestana('Potencial'))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('button', { name: 'Potencial y Despertar' })).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Sugerencia de stats' })).toBeNull()
  })

  it('la sugerencia de stats vive en la pestana Stats', async () => {
    await abrirFicha()
    fireEvent.click(pestana('Stats'))
    expect(
      within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Sugerencia de stats' })
    ).toBeInTheDocument()
  })
})
