import { useEffect, type ReactElement } from 'react'
import type { Amigo } from '../../../shared/amigos'
import BuscarUsuario from '../features/friends/BuscarUsuario'
import { useEstadoDeAmigos } from '../features/friends/EstadoDeAmigos'
import {
  ListaDeAmigos,
  SolicitudesEnviadas,
  SolicitudesRecibidas
} from '../features/friends/ListasDeAmigos'
import { useAmigos } from '../features/friends/useAmigos'
import '../features/friends/friends.css'

interface AmigosPageProps {
  readonly alVerTeams: (amigo: Amigo) => void
  readonly alSesionVencida: () => void
}

const AVISO_DE_PRIVACIDAD =
  'Tus amigos aceptados ven tus teams y fichas completas, incluidas las notas. ' +
  'Podés ocultar un team con «Oculto para amigos» y las notas de un Aniimo con «Notas privadas».'

export default function AmigosPage({ alVerTeams, alSesionVencida }: AmigosPageProps): ReactElement {
  const { refrescar } = useEstadoDeAmigos()
  const amigos = useAmigos(alSesionVencida)

  useEffect(() => {
    void refrescar()
  }, [refrescar])

  return (
    <section className="principal__seccion amigos">
      <h2 className="principal__subtitulo">Amigos</h2>
      <p className="amigos__aviso">{AVISO_DE_PRIVACIDAD}</p>
      <BuscarUsuario
        resultado={amigos.resultado}
        deshabilitado={amigos.pendiente}
        alBuscar={(nombre) => void amigos.buscar(nombre)}
        alEnviarSolicitud={(id) => void amigos.enviarSolicitud(id)}
        alAceptar={(id) => void amigos.aceptarSolicitud(id)}
      />
      {amigos.mensaje !== null && (
        <p className="amigos__mensaje" role="alert">
          {amigos.mensaje}
        </p>
      )}
      <div className="amigos__acciones">
        <button type="button" disabled={amigos.pendiente} onClick={() => void amigos.actualizar()}>
          Actualizar
        </button>
      </div>
      <SolicitudesRecibidas
        solicitudes={amigos.recibidas}
        deshabilitado={amigos.pendiente}
        alAceptar={(id) => void amigos.aceptarSolicitud(id)}
        alRechazar={(id) => void amigos.eliminar(id)}
      />
      <SolicitudesEnviadas
        solicitudes={amigos.enviadas}
        deshabilitado={amigos.pendiente}
        alCancelar={(id) => void amigos.eliminar(id)}
      />
      <ListaDeAmigos
        amigos={amigos.amigos}
        deshabilitado={amigos.pendiente}
        alVerTeams={alVerTeams}
        alEliminar={(id) => void amigos.eliminar(id)}
      />
    </section>
  )
}
