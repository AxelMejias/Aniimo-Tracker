import { useState, type FormEvent, type HTMLAttributes, type ReactElement } from 'react'
import type { ErrorDeOverlay } from '../../../../shared/overlay'
import type { ErrorDeTeams, TeamResumen } from '../../../../shared/teams'
import Confirmacion from '../../shared/components/Confirmacion'
import {
  MENSAJE_OVERLAY_NO_ABIERTO,
  mensajeDeErrorDeNombreDeTeam,
  mensajeDeErrorDeTeams
} from './mensajes'
import ControlesDeOrden from './ControlesDeOrden'
import type { Direccion } from './destinoDeArrastre'
import TarjetaAniimo from './TarjetaAniimo'

export interface OpcionDeGrupo {
  readonly id: string
  readonly nombre: string
}

interface TarjetaTeamProps {
  readonly team: TeamResumen
  readonly deshabilitado: boolean
  readonly alRenombrar: (nombre: string) => Promise<ErrorDeTeams | null>
  readonly alCambiarVisibilidad: (oculto: boolean) => Promise<ErrorDeTeams | null>
  readonly alBorrar: () => Promise<ErrorDeTeams | null>
  readonly alAbrirSlot: (teamId: string, slot: number) => void
  readonly alAbrirEnOverlay: () => Promise<ErrorDeOverlay | null>
  readonly opcionesDeGrupo: readonly OpcionDeGrupo[]
  readonly alCambiarGrupo: (grupoId: string | null) => Promise<ErrorDeTeams | null>
  readonly alElegirPortada: (slot: number | null) => Promise<ErrorDeTeams | null>
  readonly puedeSubir: boolean
  readonly puedeBajar: boolean
  readonly alMover: (direccion: Direccion) => void
  readonly esDestino: boolean
  readonly propsDeLaTarjeta: HTMLAttributes<HTMLElement>
  readonly propsDelEncabezado: HTMLAttributes<HTMLElement>
}

export default function TarjetaTeam({
  team,
  deshabilitado,
  alRenombrar,
  alCambiarVisibilidad,
  alBorrar,
  alAbrirSlot,
  alAbrirEnOverlay,
  opcionesDeGrupo,
  alCambiarGrupo,
  alElegirPortada,
  puedeSubir,
  puedeBajar,
  alMover,
  esDestino,
  propsDeLaTarjeta,
  propsDelEncabezado
}: TarjetaTeamProps): ReactElement {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(team.nombre)
  const [confirmando, setConfirmando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)

  function empezarEdicion(): void {
    setNombre(team.nombre)
    setMensaje(null)
    setEditando(true)
  }

  async function guardarNombre(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const error = await alRenombrar(nombre)
    if (error === null) {
      setEditando(false)
      setMensaje(null)
    } else {
      setMensaje(mensajeDeErrorDeNombreDeTeam(error))
    }
  }

  async function cambiarVisibilidad(oculto: boolean): Promise<void> {
    setMensaje(null)
    const error = await alCambiarVisibilidad(oculto)
    if (error !== null) {
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  async function cambiarGrupo(valor: string): Promise<void> {
    setMensaje(null)
    const error = await alCambiarGrupo(valor === '' ? null : valor)
    if (error !== null) {
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  async function elegirPortada(valor: string): Promise<void> {
    setMensaje(null)
    const error = await alElegirPortada(valor === '' ? null : Number(valor))
    if (error !== null) {
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  async function abrirEnOverlay(): Promise<void> {
    setMensaje(null)
    setAbriendo(true)
    try {
      const error = await alAbrirEnOverlay()
      if (error !== null && error.error !== 'sesion-vencida') {
        setMensaje(MENSAJE_OVERLAY_NO_ABIERTO)
      }
    } finally {
      setAbriendo(false)
    }
  }

  const slotsOcupados = team.slots.filter((slot) => slot.aniimo !== null)

  async function borrar(): Promise<void> {
    const error = await alBorrar()
    if (error !== null) {
      setConfirmando(false)
      setMensaje(mensajeDeErrorDeTeams(error))
    }
  }

  return (
    <section
      className={esDestino ? 'tarjeta-team tarjeta-team--destino' : 'tarjeta-team'}
      aria-labelledby={`team-${team.id}`}
      {...propsDeLaTarjeta}
    >
      <header className="tarjeta-team__encabezado" {...propsDelEncabezado}>
        <h4 className="tarjeta-team__nombre" id={`team-${team.id}`}>
          {team.nombre}
        </h4>
        {team.ocultoParaAmigos && (
          <span className="tarjeta-team__marca">Oculto para amigos</span>
        )}
        <div className="tarjeta-team__acciones">
          <label className="tarjeta-team__visibilidad">
            <input
              type="checkbox"
              checked={team.ocultoParaAmigos}
              disabled={deshabilitado}
              onChange={(e) => void cambiarVisibilidad(e.target.checked)}
            />
            Oculto para amigos
          </label>
          <label className="tarjeta-team__selector">
            Grupo
            <select
              value={team.grupoId ?? ''}
              disabled={deshabilitado}
              onChange={(e) => void cambiarGrupo(e.target.value)}
            >
              <option value="">Sin grupo</option>
              {opcionesDeGrupo.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.nombre}
                </option>
              ))}
            </select>
          </label>
          {slotsOcupados.length > 0 && (
            <label className="tarjeta-team__selector">
              Portada
              <select
                value={team.portadaSlot === null ? '' : String(team.portadaSlot)}
                disabled={deshabilitado}
                onChange={(e) => void elegirPortada(e.target.value)}
              >
                <option value="">Automática</option>
                {slotsOcupados.map((slot) => (
                  <option key={slot.slot} value={String(slot.slot)}>
                    {slot.aniimo?.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ControlesDeOrden
            tipo="team"
            id={team.id}
            nombre={team.nombre}
            puedeSubir={puedeSubir}
            puedeBajar={puedeBajar}
            deshabilitado={deshabilitado}
            alMover={alMover}
          />
          <button
            type="button"
            disabled={deshabilitado || abriendo}
            onClick={() => void abrirEnOverlay()}
          >
            Abrir en overlay
          </button>
          <button type="button" disabled={deshabilitado} onClick={empezarEdicion}>
            Renombrar
          </button>
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => {
              setMensaje(null)
              setConfirmando(true)
            }}
          >
            Borrar team
          </button>
        </div>
      </header>
      {editando && (
        <form className="tarjeta-team__renombrar" onSubmit={(e) => void guardarNombre(e)}>
          <label>
            Nuevo nombre
            <input
              type="text"
              value={nombre}
              disabled={deshabilitado}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <button type="submit" disabled={deshabilitado}>
            Guardar nombre
          </button>
          <button type="button" disabled={deshabilitado} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      )}
      {confirmando && (
        <Confirmacion
          mensaje={`¿Borrar el team «${team.nombre}» y todos sus Aniimo?`}
          deshabilitado={deshabilitado}
          alConfirmar={() => void borrar()}
          alCancelar={() => setConfirmando(false)}
        />
      )}
      {mensaje !== null && (
        <p className="tarjeta-team__mensaje" role="alert">
          {mensaje}
        </p>
      )}
      <div className="tarjeta-team__slots">
        {team.slots.map((slot) => (
          <TarjetaAniimo
            key={slot.slot}
            teamId={team.id}
            slot={slot.slot}
            aniimo={slot.aniimo}
            deshabilitado={deshabilitado}
            alAbrir={(numero) => alAbrirSlot(team.id, numero)}
            esPortada={slot.slot === team.portadaEfectivaSlot}
          />
        ))}
      </div>
    </section>
  )
}
