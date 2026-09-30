import {
  CANALES_AUTH,
  type Credenciales,
  type ResultadoAuth,
  type ResultadoSesion
} from '../shared/auth'
import {
  CANALES_TEAMS,
  type PedidoCrear,
  type PedidoDeSlot,
  type PedidoDeTeam,
  type PedidoGuardarFicha,
  type PedidoGuardarImagen,
  type PedidoRenombrar,
  type ResultadoFicha,
  type ResultadoImagen,
  type ResultadoListar,
  type ResultadoTeam,
  type ResultadoVacio
} from '../shared/teams'

export type Invocar = (canal: string, ...args: unknown[]) => Promise<unknown>

export interface AuthApi {
  registrarse(credenciales: Credenciales): Promise<ResultadoAuth>
  iniciarSesion(credenciales: Credenciales): Promise<ResultadoAuth>
  cerrarSesion(): Promise<ResultadoSesion>
  obtenerSesion(): Promise<ResultadoSesion>
}

export interface TeamsApi {
  listar(): Promise<ResultadoListar>
  crear(pedido: PedidoCrear): Promise<ResultadoTeam>
  renombrar(pedido: PedidoRenombrar): Promise<ResultadoTeam>
  borrar(pedido: PedidoDeTeam): Promise<ResultadoVacio>
  obtenerFicha(pedido: PedidoDeSlot): Promise<ResultadoFicha>
  guardarFicha(pedido: PedidoGuardarFicha): Promise<ResultadoFicha>
  vaciarSlot(pedido: PedidoDeSlot): Promise<ResultadoVacio>
  obtenerImagen(pedido: PedidoDeSlot): Promise<ResultadoImagen>
  guardarImagen(pedido: PedidoGuardarImagen): Promise<ResultadoVacio>
  borrarImagen(pedido: PedidoDeSlot): Promise<ResultadoVacio>
}

export interface AniimoApi {
  readonly appName: string
  readonly auth: Readonly<AuthApi>
  readonly teams: Readonly<TeamsApi>
}

// El main valida remitente y payload y solo responde con estos tipos.
function tipado<T>(promesa: Promise<unknown>): Promise<T> {
  return promesa as Promise<T>
}

export function buildExposedApi(invocar: Invocar): Readonly<AniimoApi> {
  const auth: AuthApi = {
    registrarse: (credenciales) =>
      tipado(invocar(CANALES_AUTH.registrarse, credenciales)),
    iniciarSesion: (credenciales) =>
      tipado(invocar(CANALES_AUTH.iniciarSesion, credenciales)),
    cerrarSesion: () => tipado(invocar(CANALES_AUTH.cerrarSesion)),
    obtenerSesion: () => tipado(invocar(CANALES_AUTH.obtenerSesion))
  }
  const teams: TeamsApi = {
    listar: () => tipado(invocar(CANALES_TEAMS.listar)),
    crear: (pedido) => tipado(invocar(CANALES_TEAMS.crear, pedido)),
    renombrar: (pedido) => tipado(invocar(CANALES_TEAMS.renombrar, pedido)),
    borrar: (pedido) => tipado(invocar(CANALES_TEAMS.borrar, pedido)),
    obtenerFicha: (pedido) => tipado(invocar(CANALES_TEAMS.obtenerFicha, pedido)),
    guardarFicha: (pedido) => tipado(invocar(CANALES_TEAMS.guardarFicha, pedido)),
    vaciarSlot: (pedido) => tipado(invocar(CANALES_TEAMS.vaciarSlot, pedido)),
    obtenerImagen: (pedido) => tipado(invocar(CANALES_TEAMS.obtenerImagen, pedido)),
    guardarImagen: (pedido) => tipado(invocar(CANALES_TEAMS.guardarImagen, pedido)),
    borrarImagen: (pedido) => tipado(invocar(CANALES_TEAMS.borrarImagen, pedido))
  }
  return Object.freeze({
    appName: 'Aniimo Team Tracker',
    auth: Object.freeze(auth),
    teams: Object.freeze(teams)
  })
}
