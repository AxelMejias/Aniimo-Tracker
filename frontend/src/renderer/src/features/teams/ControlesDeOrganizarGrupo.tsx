import { useState, type ReactElement } from 'react'
import type { ErrorDeTeams } from '../../../../shared/teams'
import Confirmacion from '../../shared/components/Confirmacion'
import ControlesDeOrden from './ControlesDeOrden'
import type { Direccion } from './destinoDeArrastre'
import { mensajeDeErrorDeTeams } from './mensajes'

interface ControlesDeOrganizarGrupoProps {
  readonly id: string
  readonly nombre: string
  readonly deshabilitado: boolean
  readonly puedeSubir: boolean
  readonly puedeBajar: boolean
  readonly alBorrar: () => Promise<ErrorDeTeams | null>
  readonly alMover: (direccion: Direccion) => void
}

export default function ControlesDeOrganizarGrupo({
  id,
  nombre,
  deshabilitado,
  puedeSubir,
  puedeBajar,
  alBorrar,
  alMover
}: ControlesDeOrganizarGrupoProps): ReactElement {
  const [confirmando, setConfirmando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function borrar(): Promise<void> {
    const error = await alBorrar()
    if (error !== null) {
      setConfirmando(false)
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  return (
    <>
      <div className="controles-de-grupo">
        <button
          type="button"
          aria-label={`Borrar grupo ${nombre}`}
          disabled={deshabilitado}
          onClick={() => {
            setMensaje(null)
            setConfirmando(true)
          }}
        >
          Borrar grupo
        </button>
        <ControlesDeOrden
          tipo="grupo"
          id={id}
          nombre={nombre}
          puedeSubir={puedeSubir}
          puedeBajar={puedeBajar}
          deshabilitado={deshabilitado}
          alMover={alMover}
        />
      </div>
      {confirmando && (
        <Confirmacion
          mensaje={`¿Borrar el grupo «${nombre}»? Los teams quedan sin grupo.`}
          deshabilitado={deshabilitado}
          alConfirmar={() => void borrar()}
          alCancelar={() => setConfirmando(false)}
        />
      )}
      {mensaje !== null && (
        <p className="seccion-de-grupo__mensaje" role="alert">
          {mensaje}
        </p>
      )}
    </>
  )
}
