import { vi, type Mock } from 'vitest'
import type { AmigosApi, AuthApi, CalculoApi, OverlayApi, TeamsApi } from '../../src/preload/api'
import type {
  Amigo,
  ResultadoBuscar,
  ResultadoFichaDeAmigo,
  ResultadoImagenDeAmigo,
  ResultadoListarAmigos,
  ResultadoTeamsDeAmigo,
  ResultadoUsuario,
  ResultadoVacioDeAmigos,
  Solicitud
} from '../../src/shared/amigos'
import type { ResultadoAuth, ResultadoSesion } from '../../src/shared/auth'
import type {
  ResultadoCalcular,
  ResultadoCatalogo,
  ResultadoPotencial
} from '../../src/shared/calculo'
import type { ResultadoOverlay, ResultadoSeleccion } from '../../src/shared/overlay'
import type {
  FichaDeAmigo,
  ResultadoFicha,
  ResultadoImagen,
  ResultadoListar,
  ResultadoTeam,
  ResultadoVacio,
  ResumenDeAniimo,
  TeamDeAmigo,
  TeamResumen
} from '../../src/shared/teams'
import { catalogoDeReferencia, potencialDeReferencia, sugerenciaDeReferencia } from './calculo'
import { fichaDeReferencia, omitir } from './ficha'

export const SESION_DE_AXEL: ResultadoSesion = { ok: true, nombreUsuario: 'axel' }

export const ID_DE_BRUNO = '7a1d3c52-6b0e-4f3a-8d21-5c9e4b7a0f11'
export const ID_DE_CARLA = '9c4e1b70-2d3f-4a58-b6e7-1f0a8c3d5e22'

export const BRUNO: Amigo = {
  id: ID_DE_BRUNO,
  nombreUsuario: 'bruno',
  desde: '2026-10-25T10:00:00Z'
}

export const SOLICITUD_DE_CARLA: Solicitud = {
  id: ID_DE_CARLA,
  nombreUsuario: 'carla',
  creadaEn: '2026-10-25T11:00:00Z'
}

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
  aniimos: Record<number, ResumenDeAniimo> = {},
  ocultoParaAmigos = false
): TeamResumen {
  return {
    id: `00000000-0000-4000-8000-00000000000${orden}`,
    nombre,
    orden,
    ocultoParaAmigos,
    slots: [1, 2, 3, 4].map((slot) => ({ slot, aniimo: aniimos[slot] ?? null }))
  }
}

export function teamDeAmigoDePrueba(
  nombre = 'Principal',
  orden = 1,
  aniimos: Record<number, ResumenDeAniimo> = {}
): TeamDeAmigo {
  const team = omitir(teamDePrueba(nombre, orden, aniimos), 'ocultoParaAmigos')
  return { ...team, id: `00000000-0000-4000-9000-00000000000${orden}` }
}

export function fichaDeAmigoDePrueba(cambios: Partial<FichaDeAmigo> = {}): FichaDeAmigo {
  const ficha = omitir(fichaDeReferencia(), 'notasPrivadas')
  return { ...ficha, slot: 1, tieneImagen: false, ...cambios }
}

export interface ApiFalsa {
  readonly auth: Record<keyof AuthApi, Mock>
  readonly teams: Record<keyof TeamsApi, Mock>
  readonly amigos: Record<keyof AmigosApi, Mock>
  readonly overlay: Record<keyof OverlayApi, Mock>
  readonly calculo: Record<keyof CalculoApi, Mock>
}

interface Sobrescrituras {
  readonly auth?: Partial<AuthApi>
  readonly teams?: Partial<TeamsApi>
  readonly amigos?: Partial<AmigosApi>
  readonly overlay?: Partial<OverlayApi>
  readonly calculo?: Partial<CalculoApi>
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
    cambiarVisibilidad: async (): Promise<ResultadoTeam> => ({
      ok: true,
      team: teamDePrueba('Principal', 1, {}, true)
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
  const amigos = comoMocks<AmigosApi>({
    buscar: async (): Promise<ResultadoBuscar> => ({ ok: true, usuario: null }),
    listar: async (): Promise<ResultadoListarAmigos> => ({
      ok: true,
      amigos: [],
      recibidas: [],
      enviadas: []
    }),
    enviarSolicitud: async (): Promise<ResultadoUsuario> => ({
      ok: true,
      usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno', relacion: 'solicitud-enviada' }
    }),
    aceptarSolicitud: async (): Promise<ResultadoUsuario> => ({
      ok: true,
      usuario: { id: ID_DE_CARLA, nombreUsuario: 'carla', relacion: 'amigo' }
    }),
    eliminar: async (): Promise<ResultadoVacioDeAmigos> => ({ ok: true }),
    listarTeams: async (): Promise<ResultadoTeamsDeAmigo> => ({
      ok: true,
      usuario: { id: ID_DE_BRUNO, nombreUsuario: 'bruno' },
      teams: []
    }),
    obtenerFicha: async (): Promise<ResultadoFichaDeAmigo> => ({ ok: true, ficha: null }),
    obtenerImagen: async (): Promise<ResultadoImagenDeAmigo> => ({ ok: true, imagen: null }),
    ...sobrescribir.amigos
  })
  const overlay = comoMocks<OverlayApi>({
    abrir: async (): Promise<ResultadoOverlay> => ({ ok: true }),
    cerrar: async (): Promise<ResultadoOverlay> => ({ ok: true }),
    obtenerSeleccion: async (): Promise<ResultadoSeleccion> => ({ ok: true, seleccion: null }),
    ...sobrescribir.overlay
  })
  const calculo = comoMocks<CalculoApi>({
    obtenerCatalogo: async (): Promise<ResultadoCatalogo> => ({
      ok: true,
      catalogo: catalogoDeReferencia()
    }),
    calcular: async (): Promise<ResultadoCalcular> => ({
      ok: true,
      sugerencia: sugerenciaDeReferencia()
    }),
    potencial: async (): Promise<ResultadoPotencial> => ({
      ok: true,
      potencial: potencialDeReferencia()
    }),
    ...sobrescribir.calculo
  })
  Object.defineProperty(window, 'aniimo', {
    value: { appName: 'Aniimo Team Tracker', auth, teams, amigos, overlay, calculo },
    configurable: true,
    writable: true
  })
  return { auth, teams, amigos, overlay, calculo }
}
