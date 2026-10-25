import { useId, useState, type ReactElement, type ReactNode } from 'react'
import type { Amigo, Solicitud } from '../../../../shared/amigos'
import Confirmacion from '../../shared/components/Confirmacion'

interface ListaProps {
  readonly titulo: string
  readonly vacio: string
  readonly hayElementos: boolean
  readonly children: ReactNode
}

function Lista({ titulo, vacio, hayElementos, children }: ListaProps): ReactElement {
  const id = useId()
  return (
    <section className="amigos__lista" aria-labelledby={id}>
      <h3 className="amigos__titulo" id={id}>
        {titulo}
      </h3>
      {hayElementos ? (
        <ul className="amigos__items">{children}</ul>
      ) : (
        <p className="amigos__vacio">{vacio}</p>
      )}
    </section>
  )
}

interface SolicitudesRecibidasProps {
  readonly solicitudes: readonly Solicitud[]
  readonly deshabilitado: boolean
  readonly alAceptar: (usuarioId: string) => void
  readonly alRechazar: (usuarioId: string) => void
}

export function SolicitudesRecibidas({
  solicitudes,
  deshabilitado,
  alAceptar,
  alRechazar
}: SolicitudesRecibidasProps): ReactElement {
  return (
    <Lista
      titulo="Recibidas"
      vacio="No tenés solicitudes recibidas"
      hayElementos={solicitudes.length > 0}
    >
      {solicitudes.map((solicitud) => (
        <li className="amigos__item" key={solicitud.id}>
          <span className="amigos__nombre">{solicitud.nombreUsuario}</span>
          <button type="button" disabled={deshabilitado} onClick={() => alAceptar(solicitud.id)}>
            Aceptar
          </button>
          <button type="button" disabled={deshabilitado} onClick={() => alRechazar(solicitud.id)}>
            Rechazar
          </button>
        </li>
      ))}
    </Lista>
  )
}

interface SolicitudesEnviadasProps {
  readonly solicitudes: readonly Solicitud[]
  readonly deshabilitado: boolean
  readonly alCancelar: (usuarioId: string) => void
}

export function SolicitudesEnviadas({
  solicitudes,
  deshabilitado,
  alCancelar
}: SolicitudesEnviadasProps): ReactElement {
  return (
    <Lista titulo="Enviadas" vacio="No enviaste solicitudes" hayElementos={solicitudes.length > 0}>
      {solicitudes.map((solicitud) => (
        <li className="amigos__item" key={solicitud.id}>
          <span className="amigos__nombre">{solicitud.nombreUsuario}</span>
          <button type="button" disabled={deshabilitado} onClick={() => alCancelar(solicitud.id)}>
            Cancelar
          </button>
        </li>
      ))}
    </Lista>
  )
}

interface ListaDeAmigosProps {
  readonly amigos: readonly Amigo[]
  readonly deshabilitado: boolean
  readonly alVerTeams: (amigo: Amigo) => void
  readonly alEliminar: (usuarioId: string) => void
}

export function ListaDeAmigos({
  amigos,
  deshabilitado,
  alVerTeams,
  alEliminar
}: ListaDeAmigosProps): ReactElement {
  const [confirmando, setConfirmando] = useState<string | null>(null)
  return (
    <Lista titulo="Tus amigos" vacio="Todavía no tenés amigos" hayElementos={amigos.length > 0}>
      {amigos.map((amigo) => (
        <li className="amigos__item" key={amigo.id}>
          <span className="amigos__nombre">{amigo.nombreUsuario}</span>
          <button type="button" disabled={deshabilitado} onClick={() => alVerTeams(amigo)}>
            Ver teams
          </button>
          <button type="button" disabled={deshabilitado} onClick={() => setConfirmando(amigo.id)}>
            Eliminar
          </button>
          {confirmando === amigo.id && (
            <Confirmacion
              mensaje={`¿Eliminar a ${amigo.nombreUsuario} de tus amigos? Dejarán de ver los teams del otro.`}
              deshabilitado={deshabilitado}
              etiquetaConfirmar="Confirmar eliminación"
              alConfirmar={() => {
                setConfirmando(null)
                alEliminar(amigo.id)
              }}
              alCancelar={() => setConfirmando(null)}
            />
          )}
        </li>
      ))}
    </Lista>
  )
}
