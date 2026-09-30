import {
  TIPOS_DE_IMAGEN,
  type CodigoDeErrorDeTeams,
  type ErrorDeTeams,
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
} from '../../shared/teams'
import type { SesionEnMemoria } from '../auth/sesionEnMemoria'
import { esObjetoPlano } from '../auth/validacion'
import {
  crearPeticion,
  type Cuerpo,
  type FetchFn,
  type Metodo,
  type Peticion
} from '../backend/peticion'
import {
  camposDeValidacion,
  fichaAApi,
  fichaDeApi,
  listaDeTeamsDeApi,
  RespuestaInvalida,
  teamDeApi
} from './mapeo'

const MENSAJE_MAXIMO_DE_TEAMS = 'Ya tenés el máximo de 4 teams'

export interface ClienteTeams {
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

type Contexto = 'general' | 'imagen'

function fallo(error: CodigoDeErrorDeTeams, campos?: readonly string[]): ErrorDeTeams {
  return campos === undefined ? { ok: false, error } : { ok: false, error, campos }
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json()
  } catch {
    return undefined
  }
}

async function errorDeRespuesta(
  respuesta: Response,
  contexto: Contexto,
  sesion: SesionEnMemoria
): Promise<ErrorDeTeams> {
  switch (respuesta.status) {
    case 401:
      sesion.borrar()
      return fallo('sesion-vencida')
    case 404:
      return fallo('no-encontrado')
    case 409: {
      const cuerpo = await leerJson(respuesta)
      const esMaximo = esObjetoPlano(cuerpo) && cuerpo.detail === MENSAJE_MAXIMO_DE_TEAMS
      return fallo(esMaximo ? 'limite-de-teams' : 'conflicto')
    }
    case 413:
    case 415:
      return contexto === 'imagen' ? fallo('imagen-invalida') : fallo('error-inesperado')
    case 422:
      return contexto === 'imagen'
        ? fallo('imagen-invalida')
        : fallo('datos-invalidos', camposDeValidacion(await leerJson(respuesta)))
    default:
      return fallo('error-inesperado')
  }
}

function aBase64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64')
}

export function crearClienteTeams(fetchFn: FetchFn, sesion: SesionEnMemoria): ClienteTeams {
  const pedir: Peticion = crearPeticion(fetchFn, sesion)

  async function ejecutar<T>(
    metodo: Metodo,
    ruta: string,
    exito: (respuesta: Response) => Promise<T>,
    opciones: { cuerpo?: Cuerpo; contexto?: Contexto } = {}
  ): Promise<T | ErrorDeTeams> {
    const respuesta = await pedir(metodo, ruta, opciones.cuerpo)
    if (respuesta === null) {
      return fallo('sin-conexion')
    }
    if (!respuesta.ok) {
      return errorDeRespuesta(respuesta, opciones.contexto ?? 'general', sesion)
    }
    try {
      return await exito(respuesta)
    } catch (error) {
      if (error instanceof RespuestaInvalida || error instanceof SyntaxError) {
        return fallo('error-inesperado')
      }
      throw error
    }
  }

  const rutaDeSlot = ({ teamId, slot }: PedidoDeSlot): string => `/teams/${teamId}/aniimo/${slot}`

  const vacio = async (): Promise<{ ok: true }> => ({ ok: true })

  const conFicha = async (respuesta: Response): Promise<ResultadoFicha> => {
    const { aniimo } = (await respuesta.json()) as { aniimo: unknown }
    return { ok: true, ficha: aniimo === null ? null : fichaDeApi(aniimo) }
  }

  const conTeam = async (respuesta: Response): Promise<ResultadoTeam> => ({
    ok: true,
    team: teamDeApi(await respuesta.json())
  })

  return {
    listar: () =>
      ejecutar('GET', '/teams', async (respuesta) => ({
        ok: true as const,
        teams: listaDeTeamsDeApi(await respuesta.json())
      })),
    crear: (pedido) =>
      ejecutar('POST', '/teams', conTeam, { cuerpo: { json: { nombre: pedido.nombre } } }),
    renombrar: (pedido) =>
      ejecutar('PATCH', `/teams/${pedido.teamId}`, conTeam, {
        cuerpo: { json: { nombre: pedido.nombre } }
      }),
    borrar: (pedido) => ejecutar('DELETE', `/teams/${pedido.teamId}`, vacio),
    obtenerFicha: (pedido) => ejecutar('GET', rutaDeSlot(pedido), conFicha),
    guardarFicha: (pedido) =>
      ejecutar('PUT', rutaDeSlot(pedido), conFicha, {
        cuerpo: { json: fichaAApi(pedido.ficha) }
      }),
    vaciarSlot: (pedido) => ejecutar('DELETE', rutaDeSlot(pedido), vacio),
    obtenerImagen: async (pedido) => {
      const respuesta = await pedir('GET', `${rutaDeSlot(pedido)}/imagen`)
      if (respuesta === null) {
        return fallo('sin-conexion')
      }
      if (respuesta.status === 404) {
        return { ok: true, imagen: null }
      }
      if (!respuesta.ok) {
        return errorDeRespuesta(respuesta, 'imagen', sesion)
      }
      const tipo = (respuesta.headers.get('Content-Type') ?? '').split(';')[0]?.trim() ?? ''
      if (!(TIPOS_DE_IMAGEN as readonly string[]).includes(tipo)) {
        return fallo('error-inesperado')
      }
      return { ok: true, imagen: `data:${tipo};base64,${aBase64(await respuesta.arrayBuffer())}` }
    },
    guardarImagen: (pedido) =>
      ejecutar('PUT', `${rutaDeSlot(pedido)}/imagen`, vacio, {
        cuerpo: { binario: pedido.datos, tipo: pedido.tipo },
        contexto: 'imagen'
      }),
    borrarImagen: (pedido) => ejecutar('DELETE', `${rutaDeSlot(pedido)}/imagen`, vacio)
  }
}
