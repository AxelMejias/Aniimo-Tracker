// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Confirmacion from './Confirmacion'

afterEach(cleanup)

function montar() {
  const alConfirmar = vi.fn()
  const alCancelar = vi.fn()
  render(
    <Confirmacion
      mensaje="¿Seguro?"
      deshabilitado={false}
      alConfirmar={alConfirmar}
      alCancelar={alCancelar}
    />
  )
  return { alConfirmar, alCancelar }
}

describe('Confirmacion', () => {
  it('enfoca Cancelar al aparecer', () => {
    montar()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('Escape cancela y no confirma', () => {
    const { alConfirmar, alCancelar } = montar()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(alCancelar).toHaveBeenCalledTimes(1)
    expect(alConfirmar).not.toHaveBeenCalled()
  })

  it('otras teclas no cancelan', () => {
    const { alCancelar } = montar()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'a' })
    expect(alCancelar).not.toHaveBeenCalled()
  })

  it('Escape no cancela si esta deshabilitada', () => {
    const alCancelar = vi.fn()
    render(
      <Confirmacion mensaje="x" deshabilitado alConfirmar={vi.fn()} alCancelar={alCancelar} />
    )
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    expect(alCancelar).not.toHaveBeenCalled()
  })
})
