import { describe, expect, it, vi } from 'vitest'
import { CANALES_GRUPOS } from '../../shared/grupos'
import type { EventoIpc, IpcPrincipal } from '../auth/ipcAuth'
import type { ClienteGrupos } from './clienteGrupos'
import { registrarManejadoresDeGrupos } from './ipcGrupos'

const URL_APP = 'http://localhost:5173'
const ORIGEN_PROPIO: EventoIpc = { senderFrame: { url: 'http://localhost:5173/' } }
const ORIGEN_AJENO: EventoIpc = { senderFrame: { url: 'https://example.com/' } }
const SIN_FRAME: EventoIpc = { senderFrame: null }
const G1 = '8b0e5d6a-3c21-4f7e-a1d4-9e2c7b6f0a13'
const T1 = '3f2b1c4e-8a7d-4e21-9c55-0d9f6a1b2c3d'
const T2 = '6a4c2e8f-1b3d-4f50-8e7a-2d9c1b0a3f44'

function preparar(sobrescribir: Partial<ClienteGrupos> = {}) {
  const manejadores = new Map<string, (evento: EventoIpc, payload?: unknown) => Promise<unknown>>()
  const ipc: IpcPrincipal = {
    handle: (canal, manejador) => {
      manejadores.set(canal, manejador)
    }
  }
  const lista = { ok: true as const, teams: [], grupos: [] }
  const cliente = {
    crear: vi.fn(async () => lista),
    renombrar: vi.fn(async () => lista),
    elegirPortada: vi.fn(async () => lista),
    borrar: vi.fn(async () => ({ ok: true as const })),
    agregarTeam: vi.fn(async () => lista),
    sacarTeam: vi.fn(async () => ({ ok: true as const })),
    ordenar: vi.fn(async () => lista),
    ordenarTeams: vi.fn(async () => lista),
    ordenarSueltos: vi.fn(async () => lista),
    ...sobrescribir
  } satisfies ClienteGrupos
  registrarManejadoresDeGrupos(ipc, cliente, URL_APP)
  const invocar = (canal: string, evento: EventoIpc, payload?: unknown): Promise<unknown> => {
    const manejador = manejadores.get(canal)
    if (manejador === undefined) {
      throw new Error(`canal sin manejador: ${canal}`)
    }
    return manejador(evento, payload)
  }
  return { manejadores, cliente, invocar }
}

function ids(cantidad: number): string[] {
  return Array.from(
    { length: cantidad },
    (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
  )
}

const PEDIDOS_VALIDOS: [keyof typeof CANALES_GRUPOS, keyof ClienteGrupos, unknown][] = [
  ['crear', 'crear', { nombre: 'Buildeado' }],
  ['renombrar', 'renombrar', { grupoId: G1, nombre: 'Homeland' }],
  ['elegirPortada', 'elegirPortada', { grupoId: G1, teamId: T1 }],
  ['elegirPortada', 'elegirPortada', { grupoId: G1, teamId: null }],
  ['borrar', 'borrar', { grupoId: G1 }],
  ['agregarTeam', 'agregarTeam', { grupoId: G1, teamId: T1 }],
  ['sacarTeam', 'sacarTeam', { grupoId: G1, teamId: T1 }],
  ['ordenar', 'ordenar', { grupoIds: [G1] }],
  ['ordenarTeams', 'ordenarTeams', { grupoId: G1, teamIds: [T2, T1] }],
  ['ordenarSueltos', 'ordenarSueltos', { teamIds: [T2, T1] }]
]

const PEDIDOS_INVALIDOS: [keyof typeof CANALES_GRUPOS, unknown][] = [
  ['crear', { nombre: 5 }],
  ['crear', { nombre: 'x'.repeat(51) }],
  ['crear', null],
  ['renombrar', { grupoId: 'x', nombre: 'a' }],
  ['elegirPortada', { grupoId: G1 }],
  ['elegirPortada', { grupoId: G1, teamId: 'abc' }],
  ['borrar', { grupoId: G1, extra: 1 }],
  ['agregarTeam', { grupoId: 'abc', teamId: T1 }],
  ['agregarTeam', { grupoId: G1 }],
  ['agregarTeam', { grupoId: G1, teamId: T1, extra: 1 }],
  ['agregarTeam', null],
  ['sacarTeam', { grupoId: G1, teamId: 1 }],
  ['ordenar', { grupoIds: [] }],
  ['ordenar', { grupoIds: [G1, G1] }],
  ['ordenar', { grupoIds: ['abc'] }],
  ['ordenar', { grupoIds: ids(5) }],
  ['ordenar', { grupoIds: [G1], extra: 1 }],
  ['ordenarTeams', { grupoId: G1, teamIds: [] }],
  ['ordenarTeams', { grupoId: G1, teamIds: [T1, T1] }],
  ['ordenarTeams', { grupoId: G1, teamIds: ids(6) }],
  ['ordenarTeams', { grupoId: G1, teamIds: ['abc'] }],
  ['ordenarTeams', { grupoId: G1, teamIds: [T1], extra: 1 }],
  ['ordenarSueltos', { teamIds: ids(21) }],
  ['ordenarSueltos', { teamIds: [] }],
  ['ordenarSueltos', { teamIds: [T1], extra: 1 }]
]

describe('registrarManejadoresDeGrupos', () => {
  it('registra exactamente los nueve canales de grupos', () => {
    const { manejadores } = preparar()
    expect([...manejadores.keys()].sort()).toEqual(Object.values(CANALES_GRUPOS).sort())
    expect(manejadores.size).toBe(9)
  })

  it('los nombres de canal son los fijos del contrato', () => {
    expect(CANALES_GRUPOS).toEqual({
      crear: 'grupos:crear',
      renombrar: 'grupos:renombrar',
      elegirPortada: 'grupos:elegir-portada',
      borrar: 'grupos:borrar',
      agregarTeam: 'grupos:agregar-team',
      sacarTeam: 'grupos:sacar-team',
      ordenar: 'grupos:ordenar',
      ordenarTeams: 'grupos:ordenar-teams',
      ordenarSueltos: 'grupos:ordenar-sueltos'
    })
  })

  it.each(PEDIDOS_VALIDOS)(
    '%s con remitente propio y payload valido llama al cliente con ese pedido',
    async (canal, metodo, payload) => {
      const { cliente, invocar } = preparar()
      const resultado = await invocar(CANALES_GRUPOS[canal], ORIGEN_PROPIO, payload)
      expect(resultado).toMatchObject({ ok: true })
      expect(cliente[metodo]).toHaveBeenCalledTimes(1)
      expect(cliente[metodo]).toHaveBeenCalledWith(payload)
    }
  )

  it.each(PEDIDOS_VALIDOS)(
    '%s con remitente ajeno responde datos-invalidos sin llamar al cliente',
    async (canal, _metodo, payload) => {
      const { cliente, invocar } = preparar()
      for (const evento of [ORIGEN_AJENO, SIN_FRAME]) {
        expect(await invocar(CANALES_GRUPOS[canal], evento, payload)).toEqual({
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
      expect(await invocar(CANALES_GRUPOS[canal], ORIGEN_PROPIO, payload)).toEqual({
        ok: false,
        error: 'datos-invalidos'
      })
      for (const funcion of Object.values(cliente)) {
        expect(funcion).not.toHaveBeenCalled()
      }
    }
  )

  it('devuelve tal cual el error del cliente, con contrato cerrado', async () => {
    const { invocar } = preparar({
      agregarTeam: vi.fn(async () => ({ ok: false as const, error: 'grupo-lleno' as const }))
    })
    expect(
      await invocar(CANALES_GRUPOS.agregarTeam, ORIGEN_PROPIO, { grupoId: G1, teamId: T1 })
    ).toEqual({ ok: false, error: 'grupo-lleno' })
  })

  it('una excepcion inesperada del cliente responde error-inesperado sin filtrar texto', async () => {
    const { invocar } = preparar({
      crear: vi.fn(async () => {
        throw new Error('boom con token tok-123')
      })
    })
    const resultado = await invocar(CANALES_GRUPOS.crear, ORIGEN_PROPIO, { nombre: 'A' })
    expect(resultado).toEqual({ ok: false, error: 'error-inesperado' })
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })
})
