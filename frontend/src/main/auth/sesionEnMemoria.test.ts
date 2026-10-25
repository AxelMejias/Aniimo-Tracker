import { describe, expect, it, vi } from 'vitest'
import { crearSesionEnMemoria } from './sesionEnMemoria'

describe('crearSesionEnMemoria', () => {
  it('guarda, obtiene y borra la sesion', () => {
    const sesion = crearSesionEnMemoria()
    expect(sesion.obtener()).toBeNull()
    sesion.guardar('tok', 'axel')
    expect(sesion.obtener()).toEqual({ token: 'tok', nombreUsuario: 'axel' })
    sesion.borrar()
    expect(sesion.obtener()).toBeNull()
  })

  it('alBorrar ejecuta el aviso una vez al borrar', () => {
    const sesion = crearSesionEnMemoria()
    const aviso = vi.fn()
    sesion.alBorrar(aviso)
    sesion.guardar('tok', 'axel')
    expect(aviso).not.toHaveBeenCalled()
    sesion.borrar()
    expect(aviso).toHaveBeenCalledTimes(1)
  })

  it('ejecuta todos los avisos registrados', () => {
    const sesion = crearSesionEnMemoria()
    const a = vi.fn()
    const b = vi.fn()
    sesion.alBorrar(a)
    sesion.alBorrar(b)
    sesion.borrar()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('la sesion ya esta borrada cuando corre el aviso', () => {
    const sesion = crearSesionEnMemoria()
    sesion.guardar('tok', 'axel')
    let vista: unknown = 'pendiente'
    sesion.alBorrar(() => {
      vista = sesion.obtener()
    })
    sesion.borrar()
    expect(vista).toBeNull()
  })
})
