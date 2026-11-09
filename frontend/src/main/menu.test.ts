import { describe, expect, it, vi } from 'vitest'
import { quitarMenuDeLaAplicacion } from './menu'

describe('quitarMenuDeLaAplicacion', () => {
  it('en la app empaquetada quita el menu', () => {
    const menu = { setApplicationMenu: vi.fn() }
    quitarMenuDeLaAplicacion(menu, true)
    expect(menu.setApplicationMenu).toHaveBeenCalledTimes(1)
    expect(menu.setApplicationMenu).toHaveBeenCalledWith(null)
  })

  it('en desarrollo no lo toca para conservar las DevTools', () => {
    const menu = { setApplicationMenu: vi.fn() }
    quitarMenuDeLaAplicacion(menu, false)
    expect(menu.setApplicationMenu).not.toHaveBeenCalled()
  })
})
