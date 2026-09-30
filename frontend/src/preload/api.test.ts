import { describe, expect, it, vi } from 'vitest'
import { CANALES_AUTH } from '../shared/auth'
import { CANALES_TEAMS } from '../shared/teams'
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
  it('devuelve un objeto congelado con solo appName, auth y teams', () => {
    const { api } = construir()
    expect(Object.isFrozen(api)).toBe(true)
    expect(Object.keys(api).sort()).toEqual(['appName', 'auth', 'teams'])
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

  it('teams esta congelado y tiene solo las diez funciones', () => {
    const { api } = construir()
    expect(Object.isFrozen(api.teams)).toBe(true)
    expect(Object.keys(api.teams).sort()).toEqual([
      'borrar',
      'borrarImagen',
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
      [CANALES_TEAMS.borrar, { teamId: 'x' }],
      [CANALES_TEAMS.obtenerFicha, pedido],
      [CANALES_TEAMS.vaciarSlot, pedido],
      [CANALES_TEAMS.obtenerImagen, pedido],
      [CANALES_TEAMS.borrarImagen, pedido],
      [CANALES_TEAMS.guardarFicha, ficha],
      [CANALES_TEAMS.guardarImagen, imagen]
    ])
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
