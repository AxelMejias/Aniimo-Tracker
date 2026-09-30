import { describe, expect, it, vi } from 'vitest'
import { fichaDeReferencia } from '../../../tests/fixtures/ficha'
import { CANALES_TEAMS, type TeamResumen } from '../../shared/teams'
import type { EventoIpc, IpcPrincipal } from '../auth/ipcAuth'
import type { ClienteTeams } from './clienteTeams'
import { registrarManejadoresDeTeams } from './ipcTeams'

const URL_APP = 'http://localhost:5173'
const ORIGEN_PROPIO: EventoIpc = { senderFrame: { url: 'http://localhost:5173/' } }
const ORIGEN_AJENO: EventoIpc = { senderFrame: { url: 'https://example.com/' } }
const SIN_FRAME: EventoIpc = { senderFrame: null }
const TEAM_ID = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'
const TEAM: TeamResumen = { id: TEAM_ID, nombre: 'Principal', orden: 1, slots: [] }

function preparar(sobrescribir: Partial<ClienteTeams> = {}) {
  const manejadores = new Map<string, (evento: EventoIpc, payload?: unknown) => Promise<unknown>>()
  const ipc: IpcPrincipal = {
    handle: (canal, manejador) => {
      manejadores.set(canal, manejador)
    }
  }
  const cliente = {
    listar: vi.fn(async () => ({ ok: true as const, teams: [TEAM] })),
    crear: vi.fn(async () => ({ ok: true as const, team: TEAM })),
    renombrar: vi.fn(async () => ({ ok: true as const, team: TEAM })),
    borrar: vi.fn(async () => ({ ok: true as const })),
    obtenerFicha: vi.fn(async () => ({ ok: true as const, ficha: null })),
    guardarFicha: vi.fn(async () => ({ ok: true as const, ficha: null })),
    vaciarSlot: vi.fn(async () => ({ ok: true as const })),
    obtenerImagen: vi.fn(async () => ({ ok: true as const, imagen: null })),
    guardarImagen: vi.fn(async () => ({ ok: true as const })),
    borrarImagen: vi.fn(async () => ({ ok: true as const })),
    ...sobrescribir
  } satisfies ClienteTeams
  registrarManejadoresDeTeams(ipc, cliente, URL_APP)
  const invocar = (canal: string, evento: EventoIpc, payload?: unknown): Promise<unknown> => {
    const manejador = manejadores.get(canal)
    if (manejador === undefined) {
      throw new Error(`canal sin manejador: ${canal}`)
    }
    return manejador(evento, payload)
  }
  return { manejadores, cliente, invocar }
}

const imagen = {
  teamId: TEAM_ID,
  slot: 1,
  tipo: 'image/webp',
  datos: new Uint8Array([1, 2, 3])
}

const PEDIDOS_VALIDOS: [keyof typeof CANALES_TEAMS, keyof ClienteTeams, unknown][] = [
  ['listar', 'listar', undefined],
  ['crear', 'crear', { nombre: 'Raid' }],
  ['renombrar', 'renombrar', { teamId: TEAM_ID, nombre: 'Raid' }],
  ['borrar', 'borrar', { teamId: TEAM_ID }],
  ['obtenerFicha', 'obtenerFicha', { teamId: TEAM_ID, slot: 1 }],
  ['guardarFicha', 'guardarFicha', { teamId: TEAM_ID, slot: 1, ficha: fichaDeReferencia() }],
  ['vaciarSlot', 'vaciarSlot', { teamId: TEAM_ID, slot: 1 }],
  ['obtenerImagen', 'obtenerImagen', { teamId: TEAM_ID, slot: 1 }],
  ['guardarImagen', 'guardarImagen', imagen],
  ['borrarImagen', 'borrarImagen', { teamId: TEAM_ID, slot: 1 }]
]

const PEDIDOS_INVALIDOS: [keyof typeof CANALES_TEAMS, unknown][] = [
  ['crear', { nombre: 5 }],
  ['renombrar', { teamId: 'x', nombre: 'Raid' }],
  ['borrar', { teamId: TEAM_ID, extra: 1 }],
  ['obtenerFicha', { teamId: TEAM_ID, slot: 5 }],
  ['guardarFicha', { teamId: TEAM_ID, slot: 1, ficha: { ...fichaDeReferencia(), elemento: 'metal' } }],
  ['vaciarSlot', { teamId: TEAM_ID, slot: '1' }],
  ['obtenerImagen', null],
  ['borrarImagen', { teamId: TEAM_ID }]
]

describe('registrarManejadoresDeTeams', () => {
  it('registra exactamente los diez canales de teams', () => {
    const { manejadores } = preparar()
    expect([...manejadores.keys()].sort()).toEqual(Object.values(CANALES_TEAMS).sort())
    expect(manejadores.size).toBe(10)
  })

  it.each(PEDIDOS_VALIDOS)(
    '%s con remitente propio y payload valido llama al cliente y devuelve su resultado',
    async (canal, metodo, payload) => {
      const { cliente, invocar } = preparar()
      const resultado = await invocar(CANALES_TEAMS[canal], ORIGEN_PROPIO, payload)
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
        expect(await invocar(CANALES_TEAMS[canal], evento, payload)).toEqual({
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
      expect(await invocar(CANALES_TEAMS[canal], ORIGEN_PROPIO, payload)).toEqual({
        ok: false,
        error: 'datos-invalidos'
      })
      for (const funcion of Object.values(cliente)) {
        expect(funcion).not.toHaveBeenCalled()
      }
    }
  )

  it('listar ignora cualquier payload extra y solo verifica el remitente', async () => {
    const { cliente, invocar } = preparar()
    await invocar(CANALES_TEAMS.listar, ORIGEN_PROPIO, { x: 1 })
    expect(cliente.listar).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['ArrayBuffer', { ...imagen, datos: new ArrayBuffer(3) }],
    ['1 048 577 bytes', { ...imagen, datos: new Uint8Array(1_048_577) }],
    ['0 bytes', { ...imagen, datos: new Uint8Array(0) }],
    ['svg', { ...imagen, tipo: 'image/svg+xml' }]
  ])('guardar imagen con %s responde imagen-invalida sin llamar al cliente', async (_caso, pedido) => {
    const { cliente, invocar } = preparar()
    expect(await invocar(CANALES_TEAMS.guardarImagen, ORIGEN_PROPIO, pedido)).toEqual({
      ok: false,
      error: 'imagen-invalida'
    })
    expect(cliente.guardarImagen).not.toHaveBeenCalled()
  })

  it('guardar imagen con slot invalido responde datos-invalidos', async () => {
    const { cliente, invocar } = preparar()
    expect(
      await invocar(CANALES_TEAMS.guardarImagen, ORIGEN_PROPIO, { ...imagen, slot: 9 })
    ).toEqual({ ok: false, error: 'datos-invalidos' })
    expect(cliente.guardarImagen).not.toHaveBeenCalled()
  })

  it('una excepcion inesperada del cliente responde error-inesperado', async () => {
    const { invocar } = preparar({
      listar: vi.fn(async () => {
        throw new Error('boom con token tok-123')
      })
    })
    const resultado = await invocar(CANALES_TEAMS.listar, ORIGEN_PROPIO)
    expect(resultado).toEqual({ ok: false, error: 'error-inesperado' })
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })
})
