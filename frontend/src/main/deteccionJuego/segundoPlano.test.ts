import { describe, expect, it, vi } from 'vitest'
import {
  ARGUMENTO_SEGUNDO_PLANO,
  arrancaEnSegundoPlano,
  crearSegundoPlano,
  type ItemDelIcono
} from './segundoPlano'

function preparar(empaquetado = true, inicioActivo = false) {
  const estado = { openAtLogin: inicioActivo }
  const items: ItemDelIcono[][] = []
  const dependencias = {
    empaquetado,
    inicioDeWindows: {
      leer: vi.fn(() => estado.openAtLogin),
      poner: vi.fn((opciones: { openAtLogin: boolean; args: string[] }) => {
        estado.openAtLogin = opciones.openAtLogin
      })
    },
    crearIcono: vi.fn((menu: ItemDelIcono[]) => void items.push(menu)),
    mostrarPrincipal: vi.fn(),
    detener: vi.fn(),
    salir: vi.fn()
  }
  return { segundoPlano: crearSegundoPlano(dependencias), dependencias, items }
}

describe('arrancaEnSegundoPlano', () => {
  it('es verdadero empaquetada y con el argumento', () => {
    expect(arrancaEnSegundoPlano(['app.exe', ARGUMENTO_SEGUNDO_PLANO], true)).toBe(true)
  })

  it('es falso sin el argumento', () => {
    expect(arrancaEnSegundoPlano(['app.exe'], true)).toBe(false)
  })

  it('es falso en desarrollo aunque tenga el argumento', () => {
    expect(arrancaEnSegundoPlano(['electron', ARGUMENTO_SEGUNDO_PLANO], false)).toBe(false)
  })
})

describe('ponerInicio', () => {
  it('llama a setLoginItemSettings con openAtLogin y el argumento', () => {
    const { segundoPlano, dependencias } = preparar()
    segundoPlano.ponerInicio(true)
    expect(dependencias.inicioDeWindows.poner).toHaveBeenCalledWith({
      openAtLogin: true,
      args: ['--segundo-plano']
    })
    segundoPlano.ponerInicio(false)
    expect(dependencias.inicioDeWindows.poner).toHaveBeenLastCalledWith({
      openAtLogin: false,
      args: ['--segundo-plano']
    })
  })

  it('en desarrollo no toca nunca el inicio de Windows', () => {
    const { segundoPlano, dependencias } = preparar(false)
    segundoPlano.ponerInicio(true)
    segundoPlano.ponerInicio(false)
    expect(segundoPlano.leerInicio()).toBe(false)
    expect(segundoPlano.disponible).toBe(false)
    expect(dependencias.inicioDeWindows.poner).not.toHaveBeenCalled()
    expect(dependencias.inicioDeWindows.leer).not.toHaveBeenCalled()
  })

  it('encender crea el icono para poder volver a abrir la app', () => {
    const { segundoPlano, dependencias } = preparar()
    segundoPlano.ponerInicio(true)
    expect(dependencias.crearIcono).toHaveBeenCalledTimes(1)
  })
})

describe('icono del area de notificacion', () => {
  it('tiene Abrir y Salir', () => {
    const { segundoPlano, items } = preparar()
    segundoPlano.asegurarIcono()
    expect(items[0]?.map((item) => item.etiqueta)).toEqual(['Abrir Aniimo Team Tracker', 'Salir'])
  })

  it('se crea una sola vez', () => {
    const { segundoPlano, dependencias } = preparar()
    segundoPlano.asegurarIcono()
    segundoPlano.asegurarIcono()
    expect(dependencias.crearIcono).toHaveBeenCalledTimes(1)
  })

  it('Abrir muestra la principal', () => {
    const { segundoPlano, items, dependencias } = preparar()
    segundoPlano.asegurarIcono()
    items[0]?.[0]?.alElegir()
    expect(dependencias.mostrarPrincipal).toHaveBeenCalledTimes(1)
  })

  it('Salir detiene el backend y sale', () => {
    const { segundoPlano, items, dependencias } = preparar()
    segundoPlano.asegurarIcono()
    items[0]?.[1]?.alElegir()
    expect(dependencias.detener).toHaveBeenCalledTimes(1)
    expect(dependencias.salir).toHaveBeenCalledTimes(1)
  })

  it('en desarrollo no crea el icono', () => {
    const { segundoPlano, dependencias } = preparar(false)
    segundoPlano.asegurarIcono()
    expect(dependencias.crearIcono).not.toHaveBeenCalled()
  })
})

describe('alCerrarVentana', () => {
  it('con la opcion encendida oculta la ventana en vez de cerrarla', () => {
    const { segundoPlano } = preparar(true, true)
    const evento = { preventDefault: vi.fn() }
    const ventana = { hide: vi.fn() }
    segundoPlano.alCerrarVentana(evento, ventana)
    expect(evento.preventDefault).toHaveBeenCalledTimes(1)
    expect(ventana.hide).toHaveBeenCalledTimes(1)
  })

  it('con la opcion apagada deja cerrar', () => {
    const { segundoPlano } = preparar(true, false)
    const evento = { preventDefault: vi.fn() }
    const ventana = { hide: vi.fn() }
    segundoPlano.alCerrarVentana(evento, ventana)
    expect(evento.preventDefault).not.toHaveBeenCalled()
    expect(ventana.hide).not.toHaveBeenCalled()
  })

  it('despues de Salir deja cerrar aunque la opcion siga encendida', () => {
    const { segundoPlano } = preparar(true, true)
    segundoPlano.salirDeVerdad()
    const evento = { preventDefault: vi.fn() }
    segundoPlano.alCerrarVentana(evento, { hide: vi.fn() })
    expect(evento.preventDefault).not.toHaveBeenCalled()
  })

  it('si la app ya esta saliendo por otro motivo deja cerrar', () => {
    const { segundoPlano, dependencias } = preparar(true, true)
    segundoPlano.marcarSaliendo()
    const evento = { preventDefault: vi.fn() }
    segundoPlano.alCerrarVentana(evento, { hide: vi.fn() })
    expect(evento.preventDefault).not.toHaveBeenCalled()
    expect(dependencias.salir).not.toHaveBeenCalled()
  })

  it('en desarrollo deja cerrar', () => {
    const { segundoPlano } = preparar(false, true)
    const evento = { preventDefault: vi.fn() }
    segundoPlano.alCerrarVentana(evento, { hide: vi.fn() })
    expect(evento.preventDefault).not.toHaveBeenCalled()
  })
})

describe('debeSalirAlCerrarTodo', () => {
  it('es falso mientras la opcion esta encendida', () => {
    expect(preparar(true, true).segundoPlano.debeSalirAlCerrarTodo()).toBe(false)
  })

  it('es verdadero con la opcion apagada', () => {
    expect(preparar(true, false).segundoPlano.debeSalirAlCerrarTodo()).toBe(true)
  })
})
