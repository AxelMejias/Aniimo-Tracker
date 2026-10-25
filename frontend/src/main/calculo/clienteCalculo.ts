import type {
  CodigoDeErrorDeCalculo,
  ErrorDeCalculo,
  PedidoCalcular,
  PedidoPotencial,
  ResultadoCalcular,
  ResultadoCatalogo,
  ResultadoPotencial
} from '../../shared/calculo'
import type { SesionEnMemoria } from '../auth/sesionEnMemoria'
import {
  crearPeticion,
  type Cuerpo,
  type FetchFn,
  type Metodo,
  type Peticion
} from '../backend/peticion'
import { registro, RespuestaInvalida, lista } from '../teams/mapeo'
import {
  catalogoDeApi,
  pedidoAApi,
  pedidoDePotencialAApi,
  potencialDeApi,
  sugerenciaDeApi
} from './mapeo'

export interface ClienteCalculo {
  obtenerCatalogo(): Promise<ResultadoCatalogo>
  calcular(pedido: PedidoCalcular): Promise<ResultadoCalcular>
  potencial(pedido: PedidoPotencial): Promise<ResultadoPotencial>
}

function fallo(error: CodigoDeErrorDeCalculo): ErrorDeCalculo {
  return { ok: false, error }
}

async function esEspecieDesconocida(respuesta: Response): Promise<boolean> {
  try {
    const { detail } = registro(await respuesta.json())
    return lista(detail).some((error) => {
      const { loc, type } = registro(error)
      return type === 'valor_invalido' && Array.isArray(loc) && loc[loc.length - 1] === 'especie_id'
    })
  } catch {
    return false
  }
}

export function crearClienteCalculo(fetchFn: FetchFn, sesion: SesionEnMemoria): ClienteCalculo {
  const pedir: Peticion = crearPeticion(fetchFn, sesion)

  async function errorDeRespuesta(respuesta: Response): Promise<ErrorDeCalculo> {
    if (respuesta.status === 401) {
      sesion.borrar()
      return fallo('sesion-vencida')
    }
    if (respuesta.status === 503) {
      return fallo('no-disponible')
    }
    if (respuesta.status === 422) {
      return fallo((await esEspecieDesconocida(respuesta)) ? 'especie-desconocida' : 'datos-invalidos')
    }
    return fallo('error-inesperado')
  }

  async function ejecutar<T>(
    metodo: Metodo,
    ruta: string,
    exito: (cuerpo: unknown) => T,
    cuerpo?: Cuerpo
  ): Promise<T | ErrorDeCalculo> {
    const respuesta = await pedir(metodo, ruta, cuerpo)
    if (respuesta === null) {
      return fallo('sin-conexion')
    }
    if (!respuesta.ok) {
      return errorDeRespuesta(respuesta)
    }
    try {
      return exito(await respuesta.json())
    } catch (error) {
      if (error instanceof RespuestaInvalida || error instanceof SyntaxError) {
        return fallo('error-inesperado')
      }
      throw error
    }
  }

  return {
    obtenerCatalogo: () =>
      ejecutar('GET', '/calculo/catalogo', (cuerpo) => ({
        ok: true as const,
        catalogo: catalogoDeApi(cuerpo)
      })),
    calcular: (pedido) =>
      ejecutar(
        'POST',
        '/calculo/stats',
        (cuerpo) => ({ ok: true as const, sugerencia: sugerenciaDeApi(cuerpo) }),
        { json: pedidoAApi(pedido) }
      ),
    potencial: (pedido) =>
      ejecutar(
        'POST',
        '/calculo/potencial',
        (cuerpo) => ({ ok: true as const, potencial: potencialDeApi(cuerpo) }),
        { json: pedidoDePotencialAApi(pedido) }
      )
  }
}
