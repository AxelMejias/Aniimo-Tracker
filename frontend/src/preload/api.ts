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
  CANALES_CALCULO,
  type PedidoCalcular,
  type PedidoPotencial,
  type ResultadoCalcular,
  type ResultadoCatalogo,
  type ResultadoPotencial
} from '../shared/calculo'
import {
  CANALES_GRUPOS,
  type PedidoCrearGrupo,
  type PedidoDeGrupo,
  type PedidoDeTeamEnGrupo,
  type PedidoElegirPortadaDeGrupo,
  type PedidoOrdenarGrupos,
  type PedidoOrdenarSueltos,
  type PedidoOrdenarTeams,
  type PedidoRenombrarGrupo,
  type ResultadoGrupos
} from '../shared/grupos'
import {
  CANALES_OVERLAY,
  type PedidoAbrirOverlay,
  type PedidoSeleccionarOverlay,
  type ResultadoOverlay,
  type ResultadoSeleccion
} from '../shared/overlay'
import {
  CANALES_PREFERENCIAS,
  type PedidoCambiarPreferencia,
  type ResultadoPreferencias
} from '../shared/preferencias'
import {
  CANALES_TEAMS,
  type PedidoCambiarVisibilidad,
  type PedidoCrear,
  type PedidoDeSlot,
  type PedidoDeTeam,
  type PedidoElegirPortada,
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
  elegirPortada(pedido: PedidoElegirPortada): Promise<ResultadoTeam>
  borrar(pedido: PedidoDeTeam): Promise<ResultadoVacio>
  obtenerFicha(pedido: PedidoDeSlot): Promise<ResultadoFicha>
  guardarFicha(pedido: PedidoGuardarFicha): Promise<ResultadoFicha>
  vaciarSlot(pedido: PedidoDeSlot): Promise<ResultadoVacio>
  obtenerImagen(pedido: PedidoDeSlot): Promise<ResultadoImagen>
  guardarImagen(pedido: PedidoGuardarImagen): Promise<ResultadoVacio>
  borrarImagen(pedido: PedidoDeSlot): Promise<ResultadoVacio>
}

export interface GruposApi {
  crear(pedido: PedidoCrearGrupo): Promise<ResultadoGrupos>
  renombrar(pedido: PedidoRenombrarGrupo): Promise<ResultadoGrupos>
  elegirPortada(pedido: PedidoElegirPortadaDeGrupo): Promise<ResultadoGrupos>
  borrar(pedido: PedidoDeGrupo): Promise<ResultadoVacio>
  agregarTeam(pedido: PedidoDeTeamEnGrupo): Promise<ResultadoGrupos>
  sacarTeam(pedido: PedidoDeTeamEnGrupo): Promise<ResultadoVacio>
  ordenar(pedido: PedidoOrdenarGrupos): Promise<ResultadoGrupos>
  ordenarTeams(pedido: PedidoOrdenarTeams): Promise<ResultadoGrupos>
  ordenarSueltos(pedido: PedidoOrdenarSueltos): Promise<ResultadoGrupos>
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
  seleccionar(pedido: PedidoSeleccionarOverlay): Promise<ResultadoOverlay>
  cerrar(): Promise<ResultadoOverlay>
  obtenerSeleccion(): Promise<ResultadoSeleccion>
}

export interface PreferenciasApi {
  obtener(): Promise<ResultadoPreferencias>
  cambiar(pedido: PedidoCambiarPreferencia): Promise<ResultadoPreferencias>
}

export interface CalculoApi {
  obtenerCatalogo(): Promise<ResultadoCatalogo>
  calcular(pedido: PedidoCalcular): Promise<ResultadoCalcular>
  potencial(pedido: PedidoPotencial): Promise<ResultadoPotencial>
}

export interface AniimoApi {
  readonly appName: string
  readonly auth: Readonly<AuthApi>
  readonly teams: Readonly<TeamsApi>
  readonly grupos: Readonly<GruposApi>
  readonly amigos: Readonly<AmigosApi>
  readonly overlay: Readonly<OverlayApi>
  readonly preferencias: Readonly<PreferenciasApi>
  readonly calculo: Readonly<CalculoApi>
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
    elegirPortada: (pedido) => tipado(invocar(CANALES_TEAMS.elegirPortada, pedido)),
    borrar: (pedido) => tipado(invocar(CANALES_TEAMS.borrar, pedido)),
    obtenerFicha: (pedido) => tipado(invocar(CANALES_TEAMS.obtenerFicha, pedido)),
    guardarFicha: (pedido) => tipado(invocar(CANALES_TEAMS.guardarFicha, pedido)),
    vaciarSlot: (pedido) => tipado(invocar(CANALES_TEAMS.vaciarSlot, pedido)),
    obtenerImagen: (pedido) => tipado(invocar(CANALES_TEAMS.obtenerImagen, pedido)),
    guardarImagen: (pedido) => tipado(invocar(CANALES_TEAMS.guardarImagen, pedido)),
    borrarImagen: (pedido) => tipado(invocar(CANALES_TEAMS.borrarImagen, pedido))
  }
  const grupos: GruposApi = {
    crear: (pedido) => tipado(invocar(CANALES_GRUPOS.crear, pedido)),
    renombrar: (pedido) => tipado(invocar(CANALES_GRUPOS.renombrar, pedido)),
    elegirPortada: (pedido) => tipado(invocar(CANALES_GRUPOS.elegirPortada, pedido)),
    borrar: (pedido) => tipado(invocar(CANALES_GRUPOS.borrar, pedido)),
    agregarTeam: (pedido) => tipado(invocar(CANALES_GRUPOS.agregarTeam, pedido)),
    sacarTeam: (pedido) => tipado(invocar(CANALES_GRUPOS.sacarTeam, pedido)),
    ordenar: (pedido) => tipado(invocar(CANALES_GRUPOS.ordenar, pedido)),
    ordenarTeams: (pedido) => tipado(invocar(CANALES_GRUPOS.ordenarTeams, pedido)),
    ordenarSueltos: (pedido) => tipado(invocar(CANALES_GRUPOS.ordenarSueltos, pedido))
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
    seleccionar: (pedido) => tipado(invocar(CANALES_OVERLAY.seleccionar, pedido)),
    cerrar: () => tipado(invocar(CANALES_OVERLAY.cerrar)),
    obtenerSeleccion: () => tipado(invocar(CANALES_OVERLAY.obtenerSeleccion))
  }
  const preferencias: PreferenciasApi = {
    obtener: () => tipado(invocar(CANALES_PREFERENCIAS.obtener)),
    cambiar: (pedido) => tipado(invocar(CANALES_PREFERENCIAS.cambiar, pedido))
  }
  const calculo: CalculoApi = {
    obtenerCatalogo: () => tipado(invocar(CANALES_CALCULO.obtenerCatalogo)),
    calcular: (pedido) => tipado(invocar(CANALES_CALCULO.calcular, pedido)),
    potencial: (pedido) => tipado(invocar(CANALES_CALCULO.potencial, pedido))
  }
  return Object.freeze({
    appName: 'Aniimo Team Tracker',
    auth: Object.freeze(auth),
    teams: Object.freeze(teams),
    grupos: Object.freeze(grupos),
    amigos: Object.freeze(amigos),
    overlay: Object.freeze(overlay),
    preferencias: Object.freeze(preferencias),
    calculo: Object.freeze(calculo)
  })
}
