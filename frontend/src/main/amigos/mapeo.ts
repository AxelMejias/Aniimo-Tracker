import type {
  Amigo,
  Relacion,
  Solicitud,
  UsuarioEncontrado
} from '../../shared/amigos'
import { lista, registro, RespuestaInvalida, texto } from '../teams/mapeo'

const RELACIONES: Readonly<Record<string, Relacion>> = {
  ninguna: 'ninguna',
  solicitud_enviada: 'solicitud-enviada',
  solicitud_recibida: 'solicitud-recibida',
  amigo: 'amigo'
}

function relacion(valor: unknown): Relacion {
  const traducida = typeof valor === 'string' ? RELACIONES[valor] : undefined
  if (traducida === undefined) {
    throw new RespuestaInvalida()
  }
  return traducida
}

export function usuarioDeApi(valor: unknown): UsuarioEncontrado {
  const u = registro(valor)
  return { id: texto(u.id), nombreUsuario: texto(u.nombre_usuario), relacion: relacion(u.relacion) }
}

export function busquedaDeApi(valor: unknown): UsuarioEncontrado | null {
  const { usuario } = registro(valor)
  return usuario === null ? null : usuarioDeApi(usuario)
}

function amigoDeApi(valor: unknown): Amigo {
  const a = registro(valor)
  return { id: texto(a.id), nombreUsuario: texto(a.nombre_usuario), desde: texto(a.desde) }
}

function solicitudDeApi(valor: unknown): Solicitud {
  const s = registro(valor)
  return { id: texto(s.id), nombreUsuario: texto(s.nombre_usuario), creadaEn: texto(s.creada_en) }
}

export function listaDeAmigosDeApi(valor: unknown): {
  amigos: Amigo[]
  recibidas: Solicitud[]
  enviadas: Solicitud[]
} {
  const cuerpo = registro(valor)
  return {
    amigos: lista(cuerpo.amigos).map(amigoDeApi),
    recibidas: lista(cuerpo.recibidas).map(solicitudDeApi),
    enviadas: lista(cuerpo.enviadas).map(solicitudDeApi)
  }
}
