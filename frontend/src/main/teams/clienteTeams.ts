import {
  TIPOS_DE_IMAGEN,
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
} from '../../shared/teams'
import type { SesionEnMemoria } from '../auth/sesionEnMemoria'
import { crearPeticion, type FetchFn, type Peticion } from '../backend/peticion'
import { crearEjecutor, errorDeRespuesta, fallo } from './errores'
import { fichaAApi, fichaDeApi, listaDeTeamsDeApi, teamDeApi } from './mapeo'

export interface ClienteTeams {
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

function aBase64(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64')
}

export function crearClienteTeams(fetchFn: FetchFn, sesion: SesionEnMemoria): ClienteTeams {
  const pedir: Peticion = crearPeticion(fetchFn, sesion)

  const ejecutar = crearEjecutor(pedir, sesion)

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
        ...listaDeTeamsDeApi(await respuesta.json())
      })),
    crear: (pedido) =>
      ejecutar('POST', '/teams', conTeam, { cuerpo: { json: { nombre: pedido.nombre } } }),
    renombrar: (pedido) =>
      ejecutar('PATCH', `/teams/${pedido.teamId}`, conTeam, {
        cuerpo: { json: { nombre: pedido.nombre } }
      }),
    cambiarVisibilidad: (pedido) =>
      ejecutar('PATCH', `/teams/${pedido.teamId}`, conTeam, {
        cuerpo: { json: { oculto_para_amigos: pedido.ocultoParaAmigos } }
      }),
    elegirPortada: (pedido) =>
      ejecutar('PATCH', `/teams/${pedido.teamId}`, conTeam, {
        cuerpo: { json: { portada_slot: pedido.slot } }
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
