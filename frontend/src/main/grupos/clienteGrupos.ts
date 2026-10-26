import type {
  PedidoCrearGrupo,
  PedidoDeGrupo,
  PedidoDeTeamEnGrupo,
  PedidoElegirPortadaDeGrupo,
  PedidoOrdenarGrupos,
  PedidoOrdenarSueltos,
  PedidoOrdenarTeams,
  PedidoRenombrarGrupo,
  ResultadoGrupos
} from '../../shared/grupos'
import type { ResultadoVacio } from '../../shared/teams'
import type { SesionEnMemoria } from '../auth/sesionEnMemoria'
import { crearPeticion, type FetchFn, type Peticion } from '../backend/peticion'
import { crearEjecutor } from '../teams/errores'
import { listaDeTeamsDeApi } from '../teams/mapeo'

export interface ClienteGrupos {
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

export function crearClienteGrupos(fetchFn: FetchFn, sesion: SesionEnMemoria): ClienteGrupos {
  const pedir: Peticion = crearPeticion(fetchFn, sesion)
  const ejecutar = crearEjecutor(pedir, sesion)

  const conLista = async (respuesta: Response): Promise<ResultadoGrupos> => ({
    ok: true,
    ...listaDeTeamsDeApi(await respuesta.json())
  })
  const vacio = async (): Promise<{ ok: true }> => ({ ok: true })
  const rutaDeTeam = ({ grupoId, teamId }: PedidoDeTeamEnGrupo): string =>
    `/grupos/${grupoId}/teams/${teamId}`

  return {
    crear: (pedido) =>
      ejecutar('POST', '/grupos', conLista, { cuerpo: { json: { nombre: pedido.nombre } } }),
    renombrar: (pedido) =>
      ejecutar('PATCH', `/grupos/${pedido.grupoId}`, conLista, {
        cuerpo: { json: { nombre: pedido.nombre } }
      }),
    elegirPortada: (pedido) =>
      ejecutar('PATCH', `/grupos/${pedido.grupoId}`, conLista, {
        cuerpo: { json: { portada_team_id: pedido.teamId } }
      }),
    borrar: (pedido) => ejecutar('DELETE', `/grupos/${pedido.grupoId}`, vacio),
    agregarTeam: (pedido) => ejecutar('PUT', rutaDeTeam(pedido), conLista),
    sacarTeam: (pedido) => ejecutar('DELETE', rutaDeTeam(pedido), vacio),
    ordenar: (pedido) =>
      ejecutar('PUT', '/grupos/orden', conLista, { cuerpo: { json: { grupo_ids: pedido.grupoIds } } }),
    ordenarTeams: (pedido) =>
      ejecutar('PUT', `/grupos/${pedido.grupoId}/orden`, conLista, {
        cuerpo: { json: { team_ids: pedido.teamIds } }
      }),
    ordenarSueltos: (pedido) =>
      ejecutar('PUT', '/teams/sueltos/orden', conLista, {
        cuerpo: { json: { team_ids: pedido.teamIds } }
      })
  }
}
