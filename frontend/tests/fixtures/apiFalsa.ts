import { vi, type Mock } from 'vitest'
import type { AuthApi, TeamsApi } from '../../src/preload/api'
import type { ResultadoAuth, ResultadoSesion } from '../../src/shared/auth'
import type {
  ResultadoFicha,
  ResultadoImagen,
  ResultadoListar,
  ResultadoTeam,
  ResultadoVacio,
  ResumenDeAniimo,
  TeamResumen
} from '../../src/shared/teams'

export const SESION_DE_AXEL: ResultadoSesion = { ok: true, nombreUsuario: 'axel' }

export const RESUMEN_DE_IRISALIS: ResumenDeAniimo = {
  nombre: 'Irisalis',
  nivel: 60,
  cp: 3475,
  personalidad: 'ENFJ',
  estrellaActual: 2,
  despertaresUsados: 28,
  despertaresTotal: 43,
  tieneImagen: false
}

export function teamDePrueba(
  nombre = 'Principal',
  orden = 1,
  aniimos: Record<number, ResumenDeAniimo> = {}
): TeamResumen {
  return {
    id: `00000000-0000-4000-8000-00000000000${orden}`,
    nombre,
    orden,
    slots: [1, 2, 3, 4].map((slot) => ({ slot, aniimo: aniimos[slot] ?? null }))
  }
}

export interface ApiFalsa {
  readonly auth: Record<keyof AuthApi, Mock>
  readonly teams: Record<keyof TeamsApi, Mock>
}

interface Sobrescrituras {
  readonly auth?: Partial<AuthApi>
  readonly teams?: Partial<TeamsApi>
}

type Funcion = (...args: never[]) => unknown

function comoMocks<T extends object>(funciones: T): Record<keyof T, Mock> {
  const entradas = Object.entries(funciones) as [string, Funcion][]
  return Object.fromEntries(entradas.map(([nombre, funcion]) => [nombre, vi.fn(funcion)])) as Record<
    keyof T,
    Mock
  >
}

export function instalarApi(sobrescribir: Sobrescrituras = {}): ApiFalsa {
  const auth = comoMocks<AuthApi>({
    obtenerSesion: async (): Promise<ResultadoSesion> => SESION_DE_AXEL,
    iniciarSesion: async (): Promise<ResultadoAuth> => ({ ok: true, nombreUsuario: 'axel' }),
    registrarse: async (): Promise<ResultadoAuth> => ({ ok: true, nombreUsuario: 'axel' }),
    cerrarSesion: async (): Promise<ResultadoSesion> => ({ ok: true, nombreUsuario: null }),
    ...sobrescribir.auth
  })
  const teams = comoMocks<TeamsApi>({
    listar: async (): Promise<ResultadoListar> => ({ ok: true, teams: [] }),
    crear: async (): Promise<ResultadoTeam> => ({ ok: true, team: teamDePrueba('Nuevo') }),
    renombrar: async (): Promise<ResultadoTeam> => ({
      ok: true,
      team: teamDePrueba('Renombrado')
    }),
    borrar: async (): Promise<ResultadoVacio> => ({ ok: true }),
    obtenerFicha: async (): Promise<ResultadoFicha> => ({ ok: true, ficha: null }),
    guardarFicha: async (): Promise<ResultadoFicha> => ({ ok: true, ficha: null }),
    vaciarSlot: async (): Promise<ResultadoVacio> => ({ ok: true }),
    obtenerImagen: async (): Promise<ResultadoImagen> => ({ ok: true, imagen: null }),
    guardarImagen: async (): Promise<ResultadoVacio> => ({ ok: true }),
    borrarImagen: async (): Promise<ResultadoVacio> => ({ ok: true }),
    ...sobrescribir.teams
  })
  Object.defineProperty(window, 'aniimo', {
    value: { appName: 'Aniimo Team Tracker', auth, teams },
    configurable: true,
    writable: true
  })
  return { auth, teams }
}
