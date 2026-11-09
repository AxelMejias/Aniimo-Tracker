import { describe, expect, it, vi } from 'vitest'
import { CANALES_PREFERENCIAS, type Preferencias } from '../../shared/preferencias'
import type { EventoIpc, IpcPrincipal } from '../auth/ipcAuth'
import { registrarManejadoresDePreferencias } from './ipcPreferencias'

const URL_APP = 'http://localhost:5173'
const PROPIO: EventoIpc = { senderFrame: { url: 'http://localhost:5173/' } }
const AJENO: EventoIpc = { senderFrame: { url: 'https://example.com/' } }
const SIN_FRAME: EventoIpc = { senderFrame: null }
const PREFERENCIAS: Preferencias = {
  abrirAppConElJuego: false,
  arrancarConWindows: false,
  segundoPlanoDisponible: true
}
const INVALIDO = { ok: false, error: 'datos-invalidos' }

function preparar() {
  const manejadores = new Map<string, (e: EventoIpc, p?: unknown) => Promise<unknown>>()
  const ipc: IpcPrincipal = {
    handle: (canal, manejador) => {
      manejadores.set(canal, manejador)
    }
  }
  const servicio = {
    obtener: vi.fn(async () => PREFERENCIAS),
    cambiar: vi.fn(async () => ({ ...PREFERENCIAS, abrirAppConElJuego: true }))
  }
  registrarManejadoresDePreferencias(ipc, servicio, URL_APP)
  const invocar = (canal: string, evento: EventoIpc, payload?: unknown) => {
    const manejador = manejadores.get(canal)
    if (manejador === undefined) {
      throw new Error(`sin manejador ${canal}`)
    }
    return manejador(evento, payload)
  }
  return { manejadores, servicio, invocar }
}

describe('registrarManejadoresDePreferencias', () => {
  it('registra exactamente los dos canales', () => {
    const { manejadores } = preparar()
    expect([...manejadores.keys()].sort()).toEqual(['preferencias:cambiar', 'preferencias:obtener'])
    expect(Object.values(CANALES_PREFERENCIAS)).toHaveLength(2)
  })

  it('obtener responde las preferencias', async () => {
    const { invocar } = preparar()
    expect(await invocar(CANALES_PREFERENCIAS.obtener, PROPIO)).toEqual({
      ok: true,
      preferencias: PREFERENCIAS
    })
  })

  it('cambiar con payload valido llama al servicio', async () => {
    const { invocar, servicio } = preparar()
    const resultado = await invocar(CANALES_PREFERENCIAS.cambiar, PROPIO, {
      clave: 'abrirAppConElJuego',
      valor: true
    })
    expect(servicio.cambiar).toHaveBeenCalledWith('abrirAppConElJuego', true)
    expect(resultado).toMatchObject({ ok: true, preferencias: { abrirAppConElJuego: true } })
  })

  it('cambiar acepta arrancarConWindows', async () => {
    const { invocar, servicio } = preparar()
    await invocar(CANALES_PREFERENCIAS.cambiar, PROPIO, { clave: 'arrancarConWindows', valor: false })
    expect(servicio.cambiar).toHaveBeenCalledWith('arrancarConWindows', false)
  })

  it.each([
    ['clave desconocida', { clave: 'nombreDelProceso', valor: true }],
    ['valor no booleano', { clave: 'abrirAppConElJuego', valor: 'x.exe' }],
    ['clave desconocida con valor texto', { clave: 'nombreDelProceso', valor: 'x.exe' }],
    ['claves extra', { clave: 'abrirAppConElJuego', valor: true, ruta: 'C:\\x' }],
    ['falta valor', { clave: 'abrirAppConElJuego' }],
    ['null', null],
    ['texto', 'abrirAppConElJuego']
  ])('cambiar con %s responde datos-invalidos sin cambiar nada', async (_motivo, payload) => {
    const { invocar, servicio } = preparar()
    expect(await invocar(CANALES_PREFERENCIAS.cambiar, PROPIO, payload)).toEqual(INVALIDO)
    expect(servicio.cambiar).not.toHaveBeenCalled()
  })

  it.each([
    ['ajeno', AJENO],
    ['sin frame', SIN_FRAME]
  ])('remitente %s responde datos-invalidos', async (_caso, evento) => {
    const { invocar, servicio } = preparar()
    const valido = { clave: 'abrirAppConElJuego', valor: true }
    expect(await invocar(CANALES_PREFERENCIAS.cambiar, evento, valido)).toEqual(INVALIDO)
    expect(await invocar(CANALES_PREFERENCIAS.obtener, evento)).toEqual(INVALIDO)
    expect(servicio.cambiar).not.toHaveBeenCalled()
    expect(servicio.obtener).not.toHaveBeenCalled()
  })

  it('si el servicio lanza responde error-inesperado', async () => {
    const { invocar, servicio } = preparar()
    servicio.cambiar.mockRejectedValueOnce(new Error('boom'))
    expect(
      await invocar(CANALES_PREFERENCIAS.cambiar, PROPIO, { clave: 'abrirAppConElJuego', valor: true })
    ).toEqual({ ok: false, error: 'error-inesperado' })
  })
})
