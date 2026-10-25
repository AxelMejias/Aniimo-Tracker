import { describe, expect, it, vi } from 'vitest'
import { CANALES_AMIGOS } from '../../shared/amigos'
import type { EventoIpc, IpcPrincipal } from '../auth/ipcAuth'
import type { ClienteAmigos } from './clienteAmigos'
import { registrarManejadoresDeAmigos } from './ipcAmigos'

const URL_APP = 'http://localhost:5173'
const ORIGEN_PROPIO: EventoIpc = { senderFrame: { url: 'http://localhost:5173/' } }
const ORIGEN_AJENO: EventoIpc = { senderFrame: { url: 'https://example.com/' } }
const SIN_FRAME: EventoIpc = { senderFrame: null }
const USUARIO_ID = '7a1d3c52-6b0e-4f3a-8d21-5c9e4b7a0f11'
const TEAM_ID = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'

function preparar(sobrescribir: Partial<ClienteAmigos> = {}) {
  const manejadores = new Map<string, (evento: EventoIpc, payload?: unknown) => Promise<unknown>>()
  const ipc: IpcPrincipal = {
    handle: (canal, manejador) => {
      manejadores.set(canal, manejador)
    }
  }
  const cliente = {
    buscar: vi.fn(async () => ({ ok: true as const, usuario: null })),
    listar: vi.fn(async () => ({
      ok: true as const,
      amigos: [],
      recibidas: [],
      enviadas: []
    })),
    enviarSolicitud: vi.fn(async () => ({
      ok: true as const,
      usuario: { id: USUARIO_ID, nombreUsuario: 'bruno', relacion: 'solicitud-enviada' as const }
    })),
    aceptarSolicitud: vi.fn(async () => ({
      ok: true as const,
      usuario: { id: USUARIO_ID, nombreUsuario: 'bruno', relacion: 'amigo' as const }
    })),
    eliminar: vi.fn(async () => ({ ok: true as const })),
    listarTeams: vi.fn(async () => ({
      ok: true as const,
      usuario: { id: USUARIO_ID, nombreUsuario: 'bruno' },
      teams: []
    })),
    obtenerFicha: vi.fn(async () => ({ ok: true as const, ficha: null })),
    obtenerImagen: vi.fn(async () => ({ ok: true as const, imagen: null })),
    ...sobrescribir
  } satisfies ClienteAmigos
  registrarManejadoresDeAmigos(ipc, cliente, URL_APP)
  const invocar = (canal: string, evento: EventoIpc, payload?: unknown): Promise<unknown> => {
    const manejador = manejadores.get(canal)
    if (manejador === undefined) {
      throw new Error(`canal sin manejador: ${canal}`)
    }
    return manejador(evento, payload)
  }
  return { manejadores, cliente, invocar }
}

const DE_SLOT = { usuarioId: USUARIO_ID, teamId: TEAM_ID, slot: 1 }

const PEDIDOS_VALIDOS: [keyof typeof CANALES_AMIGOS, keyof ClienteAmigos, unknown][] = [
  ['buscar', 'buscar', { nombreUsuario: 'bruno' }],
  ['listar', 'listar', undefined],
  ['enviarSolicitud', 'enviarSolicitud', { usuarioId: USUARIO_ID }],
  ['aceptarSolicitud', 'aceptarSolicitud', { usuarioId: USUARIO_ID }],
  ['eliminar', 'eliminar', { usuarioId: USUARIO_ID }],
  ['listarTeams', 'listarTeams', { usuarioId: USUARIO_ID }],
  ['obtenerFicha', 'obtenerFicha', DE_SLOT],
  ['obtenerImagen', 'obtenerImagen', DE_SLOT]
]

const PEDIDOS_INVALIDOS: [keyof typeof CANALES_AMIGOS, unknown][] = [
  ['buscar', { nombreUsuario: 'ab' }],
  ['buscar', { nombreUsuario: 5 }],
  ['buscar', null],
  ['enviarSolicitud', { usuarioId: 'bruno' }],
  ['aceptarSolicitud', { usuarioId: USUARIO_ID, extra: 1 }],
  ['eliminar', {}],
  ['listarTeams', { usuarioId: 5 }],
  ['obtenerFicha', { ...DE_SLOT, slot: 5 }],
  ['obtenerFicha', { ...DE_SLOT, usuarioId: 'x' }],
  ['obtenerFicha', { ...DE_SLOT, extra: true }],
  ['obtenerImagen', { ...DE_SLOT, slot: '1' }]
]

describe('registrarManejadoresDeAmigos', () => {
  it('registra exactamente los ocho canales de amigos', () => {
    const { manejadores } = preparar()
    expect([...manejadores.keys()].sort()).toEqual(Object.values(CANALES_AMIGOS).sort())
    expect(manejadores.size).toBe(8)
  })

  it.each(PEDIDOS_VALIDOS)(
    '%s con remitente propio y payload valido llama al cliente',
    async (canal, metodo, payload) => {
      const { cliente, invocar } = preparar()
      const resultado = await invocar(CANALES_AMIGOS[canal], ORIGEN_PROPIO, payload)
      expect(resultado).toMatchObject({ ok: true })
      expect(cliente[metodo]).toHaveBeenCalledTimes(1)
      if (payload !== undefined) {
        expect(cliente[metodo]).toHaveBeenCalledWith(payload)
      }
    }
  )

  it.each(PEDIDOS_VALIDOS)(
    '%s con remitente ajeno responde datos-invalidos sin llamar al cliente',
    async (canal, _metodo, payload) => {
      const { cliente, invocar } = preparar()
      for (const evento of [ORIGEN_AJENO, SIN_FRAME]) {
        expect(await invocar(CANALES_AMIGOS[canal], evento, payload)).toEqual({
          ok: false,
          error: 'datos-invalidos'
        })
      }
      for (const funcion of Object.values(cliente)) {
        expect(funcion).not.toHaveBeenCalled()
      }
    }
  )

  it.each(PEDIDOS_INVALIDOS)(
    '%s con payload invalido responde datos-invalidos sin llamar al cliente',
    async (canal, payload) => {
      const { cliente, invocar } = preparar()
      expect(await invocar(CANALES_AMIGOS[canal], ORIGEN_PROPIO, payload)).toEqual({
        ok: false,
        error: 'datos-invalidos'
      })
      for (const funcion of Object.values(cliente)) {
        expect(funcion).not.toHaveBeenCalled()
      }
    }
  )

  it('listar ignora cualquier payload y solo verifica el remitente', async () => {
    const { cliente, invocar } = preparar()
    await invocar(CANALES_AMIGOS.listar, ORIGEN_PROPIO, { x: 1 })
    expect(cliente.listar).toHaveBeenCalledTimes(1)
  })

  it('una excepcion inesperada del cliente responde error-inesperado sin filtrar texto', async () => {
    const { invocar } = preparar({
      listar: vi.fn(async () => {
        throw new Error('boom con token tok-123')
      })
    })
    const resultado = await invocar(CANALES_AMIGOS.listar, ORIGEN_PROPIO)
    expect(resultado).toEqual({ ok: false, error: 'error-inesperado' })
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })
})
