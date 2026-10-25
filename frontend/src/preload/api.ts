import {
  CANALES_AMIGOS,
  type PedidoBuscar,
  type PedidoDeSlotDeAmigo,
  type PedidoDeUsuario,
  type ResultadoBuscar,
  type ResultadoFichaDeAmigo,
  type ResultadoImagenDeAmigo,
  type ResultadoListarAmigos,
  type ResultadoTeamsDeAmigo,
  type ResultadoUsuario,
  type ResultadoVacioDeAmigos
} from '../shared/amigos'
import {
  CANALES_AUTH,
  type Credenciales,
  type ResultadoAuth,
  type ResultadoSesion
} from '../shared/auth'
import {
  CANALES_OVERLAY,
  type PedidoAbrirOverlay,
  type ResultadoOverlay,
  type ResultadoSeleccion
} from '../shared/overlay'
import {
  CANALES_TEAMS,
  type PedidoCambiarVisibilidad,
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
  cambiarVisibilidad(pedido: PedidoCambiarVisibilidad): Promise<ResultadoTeam>
  borrar(pedido: PedidoDeTeam): Promise<ResultadoVacio>
  obtenerFicha(pedido: PedidoDeSlot): Promise<ResultadoFicha>
  guardarFicha(pedido: PedidoGuardarFicha): Promise<ResultadoFicha>
  vaciarSlot(pedido: PedidoDeSlot): Promise<ResultadoVacio>
  obtenerImagen(pedido: PedidoDeSlot): Promise<ResultadoImagen>
  guardarImagen(pedido: PedidoGuardarImagen): Promise<ResultadoVacio>
  borrarImagen(pedido: PedidoDeSlot): Promise<ResultadoVacio>
}

export interface AmigosApi {
  buscar(pedido: PedidoBuscar): Promise<ResultadoBuscar>
  listar(): Promise<ResultadoListarAmigos>
  enviarSolicitud(pedido: PedidoDeUsuario): Promise<ResultadoUsuario>
  aceptarSolicitud(pedido: PedidoDeUsuario): Promise<ResultadoUsuario>
  eliminar(pedido: PedidoDeUsuario): Promise<ResultadoVacioDeAmigos>
  listarTeams(pedido: PedidoDeUsuario): Promise<ResultadoTeamsDeAmigo>
  obtenerFicha(pedido: PedidoDeSlotDeAmigo): Promise<ResultadoFichaDeAmigo>
  obtenerImagen(pedido: PedidoDeSlotDeAmigo): Promise<ResultadoImagenDeAmigo>
}

export interface OverlayApi {
  abrir(pedido: PedidoAbrirOverlay): Promise<ResultadoOverlay>
  cerrar(): Promise<ResultadoOverlay>
  obtenerSeleccion(): Promise<ResultadoSeleccion>
}

export interface AniimoApi {
  readonly appName: string
  readonly auth: Readonly<AuthApi>
  readonly teams: Readonly<TeamsApi>
  readonly amigos: Readonly<AmigosApi>
  readonly overlay: Readonly<OverlayApi>
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
    cambiarVisibilidad: (pedido) => tipado(invocar(CANALES_TEAMS.cambiarVisibilidad, pedido)),
    borrar: (pedido) => tipado(invocar(CANALES_TEAMS.borrar, pedido)),
    obtenerFicha: (pedido) => tipado(invocar(CANALES_TEAMS.obtenerFicha, pedido)),
    guardarFicha: (pedido) => tipado(invocar(CANALES_TEAMS.guardarFicha, pedido)),
    vaciarSlot: (pedido) => tipado(invocar(CANALES_TEAMS.vaciarSlot, pedido)),
    obtenerImagen: (pedido) => tipado(invocar(CANALES_TEAMS.obtenerImagen, pedido)),
    guardarImagen: (pedido) => tipado(invocar(CANALES_TEAMS.guardarImagen, pedido)),
    borrarImagen: (pedido) => tipado(invocar(CANALES_TEAMS.borrarImagen, pedido))
  }
  const amigos: AmigosApi = {
    buscar: (pedido) => tipado(invocar(CANALES_AMIGOS.buscar, pedido)),
    listar: () => tipado(invocar(CANALES_AMIGOS.listar)),
    enviarSolicitud: (pedido) => tipado(invocar(CANALES_AMIGOS.enviarSolicitud, pedido)),
    aceptarSolicitud: (pedido) => tipado(invocar(CANALES_AMIGOS.aceptarSolicitud, pedido)),
    eliminar: (pedido) => tipado(invocar(CANALES_AMIGOS.eliminar, pedido)),
    listarTeams: (pedido) => tipado(invocar(CANALES_AMIGOS.listarTeams, pedido)),
    obtenerFicha: (pedido) => tipado(invocar(CANALES_AMIGOS.obtenerFicha, pedido)),
    obtenerImagen: (pedido) => tipado(invocar(CANALES_AMIGOS.obtenerImagen, pedido))
  }
  const overlay: OverlayApi = {
    abrir: (pedido) => tipado(invocar(CANALES_OVERLAY.abrir, pedido)),
    cerrar: () => tipado(invocar(CANALES_OVERLAY.cerrar)),
    obtenerSeleccion: () => tipado(invocar(CANALES_OVERLAY.obtenerSeleccion))
  }
  return Object.freeze({
    appName: 'Aniimo Team Tracker',
    auth: Object.freeze(auth),
    teams: Object.freeze(teams),
    amigos: Object.freeze(amigos),
    overlay: Object.freeze(overlay)
  })
}
