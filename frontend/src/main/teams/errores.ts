import {
  MENSAJE_GRUPO_LLENO,
  MENSAJE_MAXIMO_DE_GRUPOS,
  MENSAJE_MAXIMO_DE_TEAMS,
  type CodigoDeErrorDeTeams,
  type ErrorDeTeams
} from '../../shared/teams'
import type { SesionEnMemoria } from '../auth/sesionEnMemoria'
import { esObjetoPlano } from '../auth/validacion'
import type { Cuerpo, Metodo, Peticion } from '../backend/peticion'
import { camposDeValidacion, RespuestaInvalida } from './mapeo'

export type Contexto = 'general' | 'imagen'

const CODIGO_DEL_409: Readonly<Record<string, CodigoDeErrorDeTeams>> = {
  [MENSAJE_MAXIMO_DE_TEAMS]: 'limite-de-teams',
  [MENSAJE_MAXIMO_DE_GRUPOS]: 'limite-de-grupos',
  [MENSAJE_GRUPO_LLENO]: 'grupo-lleno'
}

export function fallo(error: CodigoDeErrorDeTeams, campos?: readonly string[]): ErrorDeTeams {
  return campos === undefined ? { ok: false, error } : { ok: false, error, campos }
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json()
  } catch {
    return undefined
  }
}

export async function errorDeRespuesta(
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
      const detalle = esObjetoPlano(cuerpo) ? cuerpo.detail : undefined
      const codigo = typeof detalle === 'string' ? CODIGO_DEL_409[detalle] : undefined
      return fallo(codigo ?? 'conflicto')
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

export function crearEjecutor(pedir: Peticion, sesion: SesionEnMemoria) {
  return async function ejecutar<T>(
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
}
