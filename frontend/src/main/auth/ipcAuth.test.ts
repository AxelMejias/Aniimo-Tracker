import { describe, expect, it, vi } from 'vitest'
import { CANALES_AUTH, type ResultadoAuth, type ResultadoSesion } from '../../shared/auth'
import type { ClienteBackend } from './clienteBackend'
import { registrarManejadoresDeAuth, type EventoIpc, type IpcPrincipal } from './ipcAuth'

const URL_APP = 'http://localhost:5173'
const ORIGEN_PROPIO: EventoIpc = { senderFrame: { url: 'http://localhost:5173/' } }
const ORIGEN_AJENO: EventoIpc = { senderFrame: { url: 'https://example.com/' } }
const validas = { nombreUsuario: 'axel', contrasena: 'una-clave-larga' }

function prepararIpc(sobrescribir: Partial<ClienteBackend> = {}) {
  const manejadores = new Map<string, (evento: EventoIpc, payload?: unknown) => Promise<unknown>>()
  const ipc: IpcPrincipal = {
    handle: (canal, manejador) => {
      manejadores.set(canal, manejador)
    }
  }
  const cliente = {
    registrarse: vi.fn(async (): Promise<ResultadoAuth> => ({ ok: true, nombreUsuario: 'axel' })),
    iniciarSesion: vi.fn(async (): Promise<ResultadoAuth> => ({ ok: true, nombreUsuario: 'axel' })),
    cerrarSesion: vi.fn(
      async (): Promise<ResultadoSesion> => ({ ok: true, nombreUsuario: null })
    ),
    obtenerSesion: vi.fn(
      async (): Promise<ResultadoSesion> => ({ ok: true, nombreUsuario: 'axel' })
    ),
    ...sobrescribir
  }
  registrarManejadoresDeAuth(ipc, cliente, URL_APP)
  const invocar = (canal: string, evento: EventoIpc, payload?: unknown): Promise<unknown> => {
    const manejador = manejadores.get(canal)
    if (manejador === undefined) {
      throw new Error(`canal sin manejador: ${canal}`)
    }
    return manejador(evento, payload)
  }
  return { manejadores, cliente, invocar }
}

describe('registrarManejadoresDeAuth', () => {
  it('registra exactamente los cuatro canales de auth', () => {
    const { manejadores } = prepararIpc()
    expect([...manejadores.keys()].sort()).toEqual(Object.values(CANALES_AUTH).sort())
    expect(manejadores.size).toBe(4)
  })

  it('con remitente propio y payload valido llama al cliente y devuelve su resultado', async () => {
    const { cliente, invocar } = prepararIpc()
    expect(await invocar(CANALES_AUTH.iniciarSesion, ORIGEN_PROPIO, validas)).toEqual({
      ok: true,
      nombreUsuario: 'axel'
    })
    expect(cliente.iniciarSesion).toHaveBeenCalledWith(validas)
    await invocar(CANALES_AUTH.registrarse, ORIGEN_PROPIO, validas)
    expect(cliente.registrarse).toHaveBeenCalledWith(validas)
  })

  it.each([
    CANALES_AUTH.registrarse,
    CANALES_AUTH.iniciarSesion,
    CANALES_AUTH.cerrarSesion,
    CANALES_AUTH.obtenerSesion
  ])('%s rechaza un remitente con origen ajeno sin llamar al cliente', async (canal) => {
    const { cliente, invocar } = prepararIpc()
    expect(await invocar(canal, ORIGEN_AJENO, validas)).toEqual({
      ok: false,
      error: 'datos-invalidos'
    })
    for (const funcion of Object.values(cliente)) {
      expect(funcion).not.toHaveBeenCalled()
    }
  })

  it('rechaza un remitente sin frame', async () => {
    const { cliente, invocar } = prepararIpc()
    expect(await invocar(CANALES_AUTH.iniciarSesion, { senderFrame: null }, validas)).toEqual({
      ok: false,
      error: 'datos-invalidos'
    })
    expect(cliente.iniciarSesion).not.toHaveBeenCalled()
  })

  it.each([
    { nombreUsuario: 'axel', contrasena: 'una-clave-larga', extra: 1 },
    { nombreUsuario: 42, contrasena: 'una-clave-larga' },
    { nombreUsuario: 'axel' },
    'axel',
    null,
    undefined,
    ['axel', 'una-clave-larga'],
    { nombreUsuario: 'a'.repeat(65), contrasena: 'x' }
  ])('rechaza el payload invalido %j sin llamar al cliente', async (payload) => {
    const { cliente, invocar } = prepararIpc()
    for (const canal of [CANALES_AUTH.registrarse, CANALES_AUTH.iniciarSesion]) {
      expect(await invocar(canal, ORIGEN_PROPIO, payload)).toEqual({
        ok: false,
        error: 'datos-invalidos'
      })
    }
    expect(cliente.registrarse).not.toHaveBeenCalled()
    expect(cliente.iniciarSesion).not.toHaveBeenCalled()
  })

  it('cerrar y obtener sesion no necesitan payload', async () => {
    const { cliente, invocar } = prepararIpc()
    expect(await invocar(CANALES_AUTH.cerrarSesion, ORIGEN_PROPIO)).toEqual({
      ok: true,
      nombreUsuario: null
    })
    expect(await invocar(CANALES_AUTH.obtenerSesion, ORIGEN_PROPIO)).toEqual({
      ok: true,
      nombreUsuario: 'axel'
    })
    expect(cliente.cerrarSesion).toHaveBeenCalledTimes(1)
    expect(cliente.obtenerSesion).toHaveBeenCalledTimes(1)
  })

  it('ningun resultado contiene el token aunque el cliente lo tuviera a mano', async () => {
    const { invocar } = prepararIpc({
      iniciarSesion: async () => ({ ok: true, nombreUsuario: 'axel' })
    })
    const resultado = await invocar(CANALES_AUTH.iniciarSesion, ORIGEN_PROPIO, validas)
    expect(JSON.stringify(resultado)).not.toMatch(/token/i)
  })

  it('una excepcion inesperada del cliente devuelve error-inesperado sin detalles', async () => {
    const { invocar } = prepararIpc({
      iniciarSesion: async () => {
        throw new Error('detalle-interno-secreto')
      }
    })
    const resultado = await invocar(CANALES_AUTH.iniciarSesion, ORIGEN_PROPIO, validas)
    expect(resultado).toEqual({ ok: false, error: 'error-inesperado' })
  })
})
