import type {
  CodigoDeErrorDeAmigos,
  ErrorDeAmigos,
  PedidoBuscar,
  PedidoDeSlotDeAmigo,
  PedidoDeUsuario,
  ResultadoBuscar,
  ResultadoFichaDeAmigo,
  ResultadoImagenDeAmigo,
  ResultadoListarAmigos,
  ResultadoTeamsDeAmigo,
  ResultadoUsuario,
  ResultadoVacioDeAmigos
} from '../../shared/amigos'
import { TIPOS_DE_IMAGEN } from '../../shared/teams'
import type { SesionEnMemoria } from '../auth/sesionEnMemoria'
import {
  crearPeticion,
  type Cuerpo,
  type FetchFn,
  type Metodo,
  type Peticion
} from '../backend/peticion'
import { fichaDeAmigoDeApi, lista, registro, RespuestaInvalida, teamDeAmigoDeApi, texto } from '../teams/mapeo'
import { busquedaDeApi, listaDeAmigosDeApi, usuarioDeApi } from './mapeo'

export interface ClienteAmigos {
  buscar(pedido: PedidoBuscar): Promise<ResultadoBuscar>
  listar(): Promise<ResultadoListarAmigos>
  enviarSolicitud(pedido: PedidoDeUsuario): Promise<ResultadoUsuario>
  aceptarSolicitud(pedido: PedidoDeUsuario): Promise<ResultadoUsuario>
  eliminar(pedido: PedidoDeUsuario): Promise<ResultadoVacioDeAmigos>
  listarTeams(pedido: PedidoDeUsuario): Promise<ResultadoTeamsDeAmigo>
  obtenerFicha(pedido: PedidoDeSlotDeAmigo): Promise<ResultadoFichaDeAmigo>
  obtenerImagen(pedido: PedidoDeSlotDeAmigo): Promise<ResultadoImagenDeAmigo>
}

const CODIGO_POR_ESTADO: Readonly<Record<number, CodigoDeErrorDeAmigos>> = {
  404: 'no-encontrado',
  409: 'ya-existe',
  422: 'datos-invalidos'
}

function fallo(error: CodigoDeErrorDeAmigos): ErrorDeAmigos {
  return { ok: false, error }
}

function aBase64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64')
}

export function crearClienteAmigos(fetchFn: FetchFn, sesion: SesionEnMemoria): ClienteAmigos {
  const pedir: Peticion = crearPeticion(fetchFn, sesion)

  function errorDeRespuesta(respuesta: Response): ErrorDeAmigos {
    if (respuesta.status === 401) {
      sesion.borrar()
      return fallo('sesion-vencida')
    }
    return fallo(CODIGO_POR_ESTADO[respuesta.status] ?? 'error-inesperado')
  }

  async function ejecutar<T>(
    metodo: Metodo,
    ruta: string,
    exito: (respuesta: Response) => Promise<T>,
    cuerpo?: Cuerpo
  ): Promise<T | ErrorDeAmigos> {
    const respuesta = await pedir(metodo, ruta, cuerpo)
    if (respuesta === null) {
      return fallo('sin-conexion')
    }
    if (!respuesta.ok) {
      return errorDeRespuesta(respuesta)
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

  const rutaDeSlot = ({ usuarioId, teamId, slot }: PedidoDeSlotDeAmigo): string =>
    `/amigos/${usuarioId}/teams/${teamId}/aniimo/${slot}`

  const conUsuario = async (respuesta: Response): Promise<ResultadoUsuario> => ({
    ok: true,
    usuario: usuarioDeApi(await respuesta.json())
  })

  return {
    buscar: (pedido) =>
      ejecutar(
        'GET',
        `/usuarios?nombre_usuario=${encodeURIComponent(pedido.nombreUsuario)}`,
        async (respuesta) => ({
          ok: true as const,
          usuario: busquedaDeApi(await respuesta.json())
        })
      ),
    listar: () =>
      ejecutar('GET', '/amigos', async (respuesta) => ({
        ok: true as const,
        ...listaDeAmigosDeApi(await respuesta.json())
      })),
    enviarSolicitud: (pedido) =>
      ejecutar('POST', '/amigos/solicitudes', conUsuario, {
        json: { usuario_id: pedido.usuarioId }
      }),
    aceptarSolicitud: (pedido) =>
      ejecutar('POST', `/amigos/solicitudes/${pedido.usuarioId}/aceptar`, conUsuario),
    eliminar: (pedido) =>
      ejecutar('DELETE', `/amigos/${pedido.usuarioId}`, async () => ({ ok: true as const })),
    listarTeams: (pedido) =>
      ejecutar('GET', `/amigos/${pedido.usuarioId}/teams`, async (respuesta) => {
        const cuerpo = registro(await respuesta.json())
        const duenio = registro(cuerpo.usuario)
        return {
          ok: true as const,
          usuario: { id: texto(duenio.id), nombreUsuario: texto(duenio.nombre_usuario) },
          teams: lista(cuerpo.teams).map(teamDeAmigoDeApi)
        }
      }),
    obtenerFicha: (pedido) =>
      ejecutar('GET', rutaDeSlot(pedido), async (respuesta) => {
        const { aniimo } = registro(await respuesta.json())
        return { ok: true as const, ficha: aniimo === null ? null : fichaDeAmigoDeApi(aniimo) }
      }),
    obtenerImagen: async (pedido) => {
      const respuesta = await pedir('GET', `${rutaDeSlot(pedido)}/imagen`)
      if (respuesta === null) {
        return fallo('sin-conexion')
      }
      if (respuesta.status === 404) {
        return { ok: true, imagen: null }
      }
      if (!respuesta.ok) {
        return errorDeRespuesta(respuesta)
      }
      const tipo = (respuesta.headers.get('Content-Type') ?? '').split(';')[0]?.trim() ?? ''
      if (!(TIPOS_DE_IMAGEN as readonly string[]).includes(tipo)) {
        return fallo('error-inesperado')
      }
      return { ok: true, imagen: `data:${tipo};base64,${aBase64(await respuesta.arrayBuffer())}` }
    }
  }
}
