import { useState, type FormEvent, type ReactElement } from 'react'
import {
  LARGO_MAXIMO_NOMBRE_CORTO,
  MAXIMO_DE_GRUPOS,
  type ErrorDeTeams
} from '../../../../shared/teams'
import { mensajeDeErrorDeNombreDeGrupo } from './mensajes'

const TEXTO_MAXIMO_DE_GRUPOS = `Llegaste al máximo de ${MAXIMO_DE_GRUPOS} grupos.`

interface NuevoGrupoProps {
  readonly cantidadDeGrupos: number
  readonly deshabilitado: boolean
  readonly alCrear: (nombre: string) => Promise<ErrorDeTeams | null>
}

export default function NuevoGrupo({
  cantidadDeGrupos,
  deshabilitado,
  alCrear
}: NuevoGrupoProps): ReactElement {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (cantidadDeGrupos >= MAXIMO_DE_GRUPOS) {
    return <p className="lista-de-teams__estado">{TEXTO_MAXIMO_DE_GRUPOS}</p>
  }

  function abrir(): void {
    setNombre('')
    setMensaje(null)
    setAbierto(true)
  }

  async function confirmar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const error = await alCrear(nombre.trim())
    if (error === null) {
      setAbierto(false)
      setMensaje(null)
    } else {
      setMensaje(mensajeDeErrorDeNombreDeGrupo(error))
    }
  }

  if (!abierto) {
    return (
      <button
        className="lista-de-teams__nuevo"
        type="button"
        disabled={deshabilitado}
        onClick={abrir}
      >
        Nuevo grupo
      </button>
    )
  }

  return (
    <form className="lista-de-teams__crear" onSubmit={(e) => void confirmar(e)}>
      <label>
        Nombre del grupo
        <input
          type="text"
          value={nombre}
          placeholder="Ej.: Buildeado"
          maxLength={LARGO_MAXIMO_NOMBRE_CORTO}
          disabled={deshabilitado}
          onChange={(e) => setNombre(e.target.value)}
        />
      </label>
      <button type="submit" disabled={deshabilitado || nombre.trim() === ''}>
        Crear grupo
      </button>
      <button type="button" disabled={deshabilitado} onClick={() => setAbierto(false)}>
        Cancelar
      </button>
      {mensaje !== null && (
        <p className="lista-de-teams__mensaje" role="alert">
          {mensaje}
        </p>
      )}
    </form>
  )
}
