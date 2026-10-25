import { useId, useState, type FormEvent, type ReactElement } from 'react'
import type { UsuarioEncontrado } from '../../../../shared/amigos'

interface AccionesDeResultado {
  readonly deshabilitado: boolean
  readonly alEnviarSolicitud: (usuarioId: string) => void
  readonly alAceptar: (usuarioId: string) => void
}

interface BuscarUsuarioProps extends AccionesDeResultado {
  readonly resultado: UsuarioEncontrado | null | undefined
  readonly alBuscar: (nombreUsuario: string) => void
}

function Accion({
  usuario,
  deshabilitado,
  alEnviarSolicitud,
  alAceptar
}: AccionesDeResultado & { readonly usuario: UsuarioEncontrado }): ReactElement {
  switch (usuario.relacion) {
    case 'ninguna':
      return (
        <button type="button" disabled={deshabilitado} onClick={() => alEnviarSolicitud(usuario.id)}>
          Enviar solicitud
        </button>
      )
    case 'solicitud-enviada':
      return <span>Solicitud enviada</span>
    case 'solicitud-recibida':
      return (
        <button type="button" disabled={deshabilitado} onClick={() => alAceptar(usuario.id)}>
          Aceptar
        </button>
      )
    case 'amigo':
      return <span>Ya son amigos</span>
  }
}

export default function BuscarUsuario({
  resultado,
  deshabilitado,
  alBuscar,
  alEnviarSolicitud,
  alAceptar
}: BuscarUsuarioProps): ReactElement {
  const [nombre, setNombre] = useState('')
  const idTitulo = useId()

  function enviar(evento: FormEvent): void {
    evento.preventDefault()
    alBuscar(nombre)
  }

  return (
    <div className="amigos__buscador">
      <form className="amigos__formulario" onSubmit={enviar} noValidate>
        <label className="amigos__campo">
          Nombre de usuario
          <input
            type="text"
            maxLength={64}
            value={nombre}
            disabled={deshabilitado}
            onChange={(evento) => setNombre(evento.target.value)}
          />
        </label>
        <button type="submit" disabled={deshabilitado}>
          Buscar
        </button>
      </form>
      {resultado === null && <p className="amigos__vacio">No hay ningún usuario con ese nombre</p>}
      {resultado !== undefined && resultado !== null && (
        <section className="amigos__resultado" aria-labelledby={idTitulo}>
          <h3 className="amigos__titulo-oculto" id={idTitulo}>
            Resultado de la búsqueda
          </h3>
          <span className="amigos__nombre">{resultado.nombreUsuario}</span>
          <Accion
            usuario={resultado}
            deshabilitado={deshabilitado}
            alEnviarSolicitud={alEnviarSolicitud}
            alAceptar={alAceptar}
          />
        </section>
      )}
    </div>
  )
}
