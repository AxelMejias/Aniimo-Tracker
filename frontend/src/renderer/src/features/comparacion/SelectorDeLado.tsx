import { useEffect, useRef, useState, type ReactElement } from 'react'
import { CampoDeSeleccion } from '../aniimo/Campos'

export interface SeleccionDeLado {
  readonly duenio: string
  readonly teamId: string
  readonly slot: string
}

export const SELECCION_VACIA: SeleccionDeLado = { duenio: '', teamId: '', slot: '' }
export const DUENIO_PROPIO = 'yo'

export interface OpcionDeDuenio {
  readonly codigo: string
  readonly etiqueta: string
}

interface EquipoElegible {
  readonly codigo: string
  readonly etiqueta: string
}

interface SelectorDeLadoProps {
  readonly titulo: string
  readonly seleccion: SeleccionDeLado
  readonly duenios: readonly OpcionDeDuenio[]
  readonly alCambiar: (siguiente: SeleccionDeLado) => void
  readonly alSinAcceso: () => void
  readonly alSesionVencida: () => void
}

const SLOTS = [1, 2, 3, 4].map((slot) => ({ codigo: String(slot), etiqueta: `Slot ${slot}` }))

async function equiposDe(duenio: string): Promise<EquipoElegible[] | 'sin-acceso' | 'sesion-vencida'> {
  if (duenio === DUENIO_PROPIO) {
    const resultado = await window.aniimo.teams.listar()
    if (!resultado.ok) {
      return resultado.error === 'sesion-vencida' ? 'sesion-vencida' : 'sin-acceso'
    }
    return resultado.teams.map((team) => ({ codigo: team.id, etiqueta: team.nombre }))
  }
  const resultado = await window.aniimo.amigos.listarTeams({ usuarioId: duenio })
  if (!resultado.ok) {
    return resultado.error === 'sesion-vencida' ? 'sesion-vencida' : 'sin-acceso'
  }
  return resultado.teams.map((team) => ({ codigo: team.id, etiqueta: team.nombre }))
}

export default function SelectorDeLado({
  titulo,
  seleccion,
  duenios,
  alCambiar,
  alSinAcceso,
  alSesionVencida
}: SelectorDeLadoProps): ReactElement {
  const [equipos, setEquipos] = useState<readonly EquipoElegible[]>([])
  const avisos = useRef({ alSinAcceso, alSesionVencida })
  avisos.current = { alSinAcceso, alSesionVencida }

  useEffect(() => {
    if (seleccion.duenio === '') {
      setEquipos([])
      return
    }
    let activo = true
    void equiposDe(seleccion.duenio).then((resultado) => {
      if (!activo) {
        return
      }
      if (resultado === 'sesion-vencida') {
        avisos.current.alSesionVencida()
      } else if (resultado === 'sin-acceso') {
        setEquipos([])
        avisos.current.alSinAcceso()
      } else {
        setEquipos(resultado)
      }
    })
    return () => {
      activo = false
    }
  }, [seleccion.duenio])

  return (
    <fieldset className="comparacion__lado" aria-label={titulo}>
      <legend className="comparacion__titulo">{titulo}</legend>
      <CampoDeSeleccion
        etiqueta="Dueño"
        valor={seleccion.duenio}
        opciones={duenios}
        opcional
        sinElegir="Sin elegir"
        alCambiar={(duenio) => alCambiar({ duenio, teamId: '', slot: '' })}
      />
      <CampoDeSeleccion
        etiqueta="Team"
        valor={seleccion.teamId}
        opciones={equipos}
        opcional
        sinElegir="Sin elegir"
        deshabilitado={seleccion.duenio === ''}
        alCambiar={(teamId) => alCambiar({ ...seleccion, teamId, slot: '' })}
      />
      <CampoDeSeleccion
        etiqueta="Slot"
        valor={seleccion.slot}
        opciones={SLOTS}
        opcional
        sinElegir="Todo el team"
        deshabilitado={seleccion.teamId === ''}
        alCambiar={(slot) => alCambiar({ ...seleccion, slot })}
      />
    </fieldset>
  )
}
