import { describe, expect, it, vi } from 'vitest'
import { CANALES_AMIGOS } from '../shared/amigos'
import { CANALES_AUTH } from '../shared/auth'
import { CANALES_CALCULO } from '../shared/calculo'
import { CANALES_OVERLAY } from '../shared/overlay'
import { CANALES_TEAMS } from '../shared/teams'
import { pedidoDeReferencia } from '../../tests/fixtures/calculo'
import { fichaDeReferencia } from '../../tests/fixtures/ficha'
import { buildExposedApi, type Invocar } from './api'

const credenciales = { nombreUsuario: 'axel', contrasena: 'una-clave-larga' }

function construir(resultado: unknown = { ok: true, nombreUsuario: 'axel' }) {
  const invoke = vi.fn<Invocar>(async () => resultado)
  return { api: buildExposedApi(invoke), invoke }
}

function valoresRecorridos(raiz: unknown, vistos = new Set<unknown>()): unknown[] {
  if ((typeof raiz !== 'object' && typeof raiz !== 'function') || raiz === null || vistos.has(raiz)) {
    return []
  }
  vistos.add(raiz)
  const hijos = Object.values(raiz)
  return [raiz, ...hijos.flatMap((hijo) => valoresRecorridos(hijo, vistos))]
}

describe('buildExposedApi', () => {
  it('devuelve un objeto congelado con solo appName, auth, teams, amigos, overlay y calculo', () => {
    const { api } = construir()
    expect(Object.isFrozen(api)).toBe(true)
    expect(Object.keys(api).sort()).toEqual([
      'amigos',
      'appName',
      'auth',
      'calculo',
      'overlay',
      'teams'
    ])
    expect(api.appName).toBe('Aniimo Team Tracker')
  })

  it('auth esta congelado y tiene solo las cuatro funciones', () => {
    const { api } = construir()
    expect(Object.isFrozen(api.auth)).toBe(true)
    expect(Object.keys(api.auth).sort()).toEqual([
      'cerrarSesion',
      'iniciarSesion',
      'obtenerSesion',
      'registrarse'
    ])
    for (const funcion of Object.values(api.auth)) {
      expect(typeof funcion).toBe('function')
    }
  })

  it('teams esta congelado y tiene solo las once funciones', () => {
    const { api } = construir()
    expect(Object.isFrozen(api.teams)).toBe(true)
    expect(Object.keys(api.teams).sort()).toEqual([
      'borrar',
      'borrarImagen',
      'cambiarVisibilidad',
      'crear',
      'guardarFicha',
      'guardarImagen',
      'listar',
      'obtenerFicha',
      'obtenerImagen',
      'renombrar',
      'vaciarSlot'
    ])
    for (const funcion of Object.values(api.teams)) {
      expect(typeof funcion).toBe('function')
    }
  })

  it('cada funcion de teams invoca su canal fijo con el payload', async () => {
    const { api, invoke } = construir()
    const pedido = { teamId: 'x', slot: 1 }
    await api.teams.listar()
    await api.teams.crear({ nombre: 'Raid' })
    await api.teams.renombrar({ teamId: 'x', nombre: 'Raid' })
    await api.teams.cambiarVisibilidad({ teamId: 'x', ocultoParaAmigos: true })
    await api.teams.borrar({ teamId: 'x' })
    await api.teams.obtenerFicha(pedido)
    await api.teams.vaciarSlot(pedido)
    await api.teams.obtenerImagen(pedido)
    await api.teams.borrarImagen(pedido)
    const ficha = { ...pedido, ficha: fichaDeReferencia() }
    await api.teams.guardarFicha(ficha)
    const imagen = { ...pedido, tipo: 'image/png' as const, datos: new Uint8Array([1]) }
    await api.teams.guardarImagen(imagen)
    expect(invoke.mock.calls).toEqual([
      [CANALES_TEAMS.listar],
      [CANALES_TEAMS.crear, { nombre: 'Raid' }],
      [CANALES_TEAMS.renombrar, { teamId: 'x', nombre: 'Raid' }],
      [CANALES_TEAMS.cambiarVisibilidad, { teamId: 'x', ocultoParaAmigos: true }],
      [CANALES_TEAMS.borrar, { teamId: 'x' }],
      [CANALES_TEAMS.obtenerFicha, pedido],
      [CANALES_TEAMS.vaciarSlot, pedido],
      [CANALES_TEAMS.obtenerImagen, pedido],
      [CANALES_TEAMS.borrarImagen, pedido],
      [CANALES_TEAMS.guardarFicha, ficha],
      [CANALES_TEAMS.guardarImagen, imagen]
    ])
  })

  it('amigos esta congelado y tiene solo las ocho funciones', () => {
    const { api } = construir()
    expect(Object.isFrozen(api.amigos)).toBe(true)
    expect(Object.keys(api.amigos).sort()).toEqual([
      'aceptarSolicitud',
      'buscar',
      'eliminar',
      'enviarSolicitud',
      'listar',
      'listarTeams',
      'obtenerFicha',
      'obtenerImagen'
    ])
    for (const funcion of Object.values(api.amigos)) {
      expect(typeof funcion).toBe('function')
    }
  })

  it('cada funcion de amigos invoca su canal fijo con el payload', async () => {
    const { api, invoke } = construir()
    const usuario = { usuarioId: 'u' }
    const slot = { usuarioId: 'u', teamId: 't', slot: 2 }
    await api.amigos.buscar({ nombreUsuario: 'bruno' })
    await api.amigos.listar()
    await api.amigos.enviarSolicitud(usuario)
    await api.amigos.aceptarSolicitud(usuario)
    await api.amigos.eliminar(usuario)
    await api.amigos.listarTeams(usuario)
    await api.amigos.obtenerFicha(slot)
    await api.amigos.obtenerImagen(slot)
    expect(invoke.mock.calls).toEqual([
      [CANALES_AMIGOS.buscar, { nombreUsuario: 'bruno' }],
      [CANALES_AMIGOS.listar],
      [CANALES_AMIGOS.enviarSolicitud, usuario],
      [CANALES_AMIGOS.aceptarSolicitud, usuario],
      [CANALES_AMIGOS.eliminar, usuario],
      [CANALES_AMIGOS.listarTeams, usuario],
      [CANALES_AMIGOS.obtenerFicha, slot],
      [CANALES_AMIGOS.obtenerImagen, slot]
    ])
  })

  it('overlay esta congelado y tiene solo abrir, cerrar y obtenerSeleccion', () => {
    const { api } = construir()
    expect(Object.isFrozen(api.overlay)).toBe(true)
    expect(Object.keys(api.overlay).sort()).toEqual(['abrir', 'cerrar', 'obtenerSeleccion'])
    for (const funcion of Object.values(api.overlay)) {
      expect(typeof funcion).toBe('function')
    }
  })

  it('cada funcion del overlay invoca su canal fijo con el payload', async () => {
    const { api, invoke } = construir()
    await api.overlay.abrir({ teamId: 't' })
    await api.overlay.cerrar()
    await api.overlay.obtenerSeleccion()
    expect(invoke.mock.calls).toEqual([
      [CANALES_OVERLAY.abrir, { teamId: 't' }],
      [CANALES_OVERLAY.cerrar],
      [CANALES_OVERLAY.obtenerSeleccion]
    ])
  })

  it('calculo esta congelado y tiene solo obtenerCatalogo y calcular', () => {
    const { api } = construir()
    expect(Object.isFrozen(api.calculo)).toBe(true)
    expect(Object.keys(api.calculo).sort()).toEqual(['calcular', 'obtenerCatalogo'])
    for (const funcion of Object.values(api.calculo)) {
      expect(typeof funcion).toBe('function')
    }
  })

  it('cada funcion del calculo invoca su canal fijo con el payload', async () => {
    const { api, invoke } = construir()
    await api.calculo.obtenerCatalogo()
    await api.calculo.calcular(pedidoDeReferencia())
    expect(invoke.mock.calls).toEqual([
      [CANALES_CALCULO.obtenerCatalogo],
      [CANALES_CALCULO.calcular, pedidoDeReferencia()]
    ])
  })

  it('las funciones del calculo devuelven el resultado del main sin transformarlo', async () => {
    const { api } = construir({ ok: false, error: 'no-disponible' })
    expect(await api.calculo.obtenerCatalogo()).toEqual({ ok: false, error: 'no-disponible' })
    expect(await api.calculo.calcular(pedidoDeReferencia())).toEqual({
      ok: false,
      error: 'no-disponible'
    })
  })

  it('las funciones del overlay devuelven el resultado del main sin transformarlo', async () => {
    const { api } = construir({ ok: false, error: 'sesion-vencida' })
    expect(await api.overlay.abrir({ teamId: 't' })).toEqual({ ok: false, error: 'sesion-vencida' })
  })

  it('las funciones de amigos devuelven el resultado del main sin transformarlo', async () => {
    const { api } = construir({ ok: false, error: 'no-encontrado' })
    expect(await api.amigos.listarTeams({ usuarioId: 'u' })).toEqual({
      ok: false,
      error: 'no-encontrado'
    })
  })

  it('las funciones de teams devuelven el resultado del main sin transformarlo', async () => {
    const { api } = construir({ ok: false, error: 'no-encontrado' })
    expect(await api.teams.obtenerFicha({ teamId: 'x', slot: 1 })).toEqual({
      ok: false,
      error: 'no-encontrado'
    })
  })

  it('iniciarSesion invoca su canal fijo con las credenciales y devuelve el resultado', async () => {
    const { api, invoke } = construir({ ok: false, error: 'credenciales-invalidas' })
    const resultado = await api.auth.iniciarSesion(credenciales)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith(CANALES_AUTH.iniciarSesion, credenciales)
    expect(resultado).toEqual({ ok: false, error: 'credenciales-invalidas' })
  })

  it('registrarse invoca su canal fijo con las credenciales', async () => {
    const { api, invoke } = construir()
    await api.auth.registrarse(credenciales)
    expect(invoke).toHaveBeenCalledWith(CANALES_AUTH.registrarse, credenciales)
  })

  it('cerrarSesion y obtenerSesion invocan su canal fijo sin payload', async () => {
    const { api, invoke } = construir()
    await api.auth.cerrarSesion()
    await api.auth.obtenerSesion()
    expect(invoke).toHaveBeenNthCalledWith(1, CANALES_AUTH.cerrarSesion)
    expect(invoke).toHaveBeenNthCalledWith(2, CANALES_AUTH.obtenerSesion)
  })

  it('las funciones ignoran argumentos extra que intenten elegir otro canal', async () => {
    const { api, invoke } = construir()
    const cerrar = api.auth.cerrarSesion as unknown as (...args: unknown[]) => Promise<unknown>
    await cerrar('otro:canal', { x: 1 })
    expect(invoke).toHaveBeenCalledWith(CANALES_AUTH.cerrarSesion)
  })

  it('ningun valor recorrido es ipcRenderer ni expone send, on o invoke', () => {
    const ipcRendererFalso = {
      invoke: async () => undefined,
      send: () => undefined,
      on: () => undefined
    }
    const api = buildExposedApi(ipcRendererFalso.invoke)
    for (const valor of valoresRecorridos(api)) {
      expect(valor).not.toBe(ipcRendererFalso)
      if (typeof valor === 'object') {
        const registro = valor as Record<string, unknown>
        for (const metodo of ['send', 'on', 'invoke']) {
          expect(registro[metodo]).toBeUndefined()
        }
      }
    }
  })
})
