import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react'
import type { ErrorDeTeams } from '../../../../shared/teams'
import Confirmacion from '../../shared/components/Confirmacion'
import CartaAniimo from '../mazo/CartaAniimo'
import AgruparTeam from './AgruparTeam'
import {
  MENSAJE_OVERLAY_NO_ABIERTO,
  mensajeDeErrorDeNombreDeTeam,
  mensajeDeErrorDeTeams
} from './mensajes'
import { armarSecciones, opcionesDeGrupo } from './secciones'
import { useTeams } from './useTeams'
import './pantallaDeTeam.css'

interface PantallaDeTeamProps {
  readonly teamId: string
  readonly alAbrirSlot: (teamId: string, slot: number) => void
  readonly alCambiarDeTeam: (teamId: string) => void
  readonly alVolverAMisTeams: (grupoId?: string) => void
  readonly alNoEncontrado: () => void
  readonly alSesionVencida: () => void
}

export default function PantallaDeTeam({
  teamId,
  alAbrirSlot,
  alCambiarDeTeam,
  alVolverAMisTeams,
  alNoEncontrado,
  alSesionVencida
}: PantallaDeTeamProps): ReactElement {
  const equipo = useTeams(alSesionVencida)
  const { estado, pendiente } = equipo
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [eligiendoPortada, setEligiendoPortada] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const borrando = useRef(false)
  const titulo = useRef<HTMLHeadingElement>(null)

  const secciones =
    estado.tipo === 'listo'
      ? armarSecciones(estado.teams, estado.grupos)
      : { grupos: [], sueltos: [] }
  const team = estado.tipo === 'listo' ? estado.teams.find((t) => t.id === teamId) : undefined
  const noExiste = estado.tipo === 'listo' && team === undefined

  const idCargado = team?.id

  useEffect(() => {
    if (idCargado !== undefined) {
      titulo.current?.focus()
    }
  }, [idCargado])

  useEffect(() => {
    if (noExiste && !borrando.current) {
      alNoEncontrado()
    }
  }, [noExiste, alNoEncontrado])

  if (estado.tipo === 'cargando') {
    return <p className="lista-de-teams__estado">Cargando teams…</p>
  }
  if (estado.tipo === 'error') {
    return (
      <div className="lista-de-teams__estado">
        <p role="alert">{mensajeDeErrorDeTeams(estado.error)}</p>
        <button type="button" onClick={() => void equipo.recargar()}>
          Reintentar
        </button>
      </div>
    )
  }
  if (team === undefined) {
    return <p className="lista-de-teams__estado">Cargando teams…</p>
  }

  const seccion = secciones.grupos.find(({ grupo }) => grupo.id === team.grupoId)
  const posicion = seccion === undefined ? 0 : seccion.teams.findIndex((t) => t.id === team.id) + 1
  const esPortadaDelGrupo = seccion?.grupo.portadaEfectivaTeamId === team.id
  const ocupados = team.slots.filter((slot) => slot.aniimo !== null)

  async function ejecutar(accion: Promise<ErrorDeTeams | null>): Promise<boolean> {
    setMensaje(null)
    const error = await accion
    if (error !== null) {
      setMensaje(mensajeDeErrorDeTeams(error))
    }
    return error === null
  }

  async function guardarNombre(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const error = await equipo.renombrar(teamId, nombre)
    if (error === null) {
      setEditando(false)
      setMensaje(null)
    } else {
      setMensaje(mensajeDeErrorDeNombreDeTeam(error))
    }
  }

  async function abrirEnOverlay(): Promise<void> {
    setMensaje(null)
    setAbriendo(true)
    try {
      const resultado = await window.aniimo.overlay.abrir({ teamId })
      if (resultado.ok) {
        return
      }
      if (resultado.error === 'sesion-vencida') {
        alSesionVencida()
      } else {
        setMensaje(MENSAJE_OVERLAY_NO_ABIERTO)
      }
    } finally {
      setAbriendo(false)
    }
  }

  async function borrar(): Promise<void> {
    borrando.current = true
    const error = await equipo.borrar(teamId)
    if (error === null) {
      alVolverAMisTeams()
      return
    }
    borrando.current = false
    setConfirmando(false)
    setMensaje(mensajeDeErrorDeTeams(error))
  }

  return (
    <section className="pantalla-de-team">
      <nav className="pantalla-de-team__migas" aria-label="Ubicación">
        <button type="button" onClick={() => alVolverAMisTeams()}>
          Mis teams
        </button>
        {seccion !== undefined && (
          <>
            <span aria-hidden="true">›</span>
            <button type="button" onClick={() => alVolverAMisTeams(seccion.grupo.id)}>
              {seccion.grupo.nombre}
            </button>
          </>
        )}
        <span aria-hidden="true">›</span>
        <span aria-current="page">{team.nombre}</span>
      </nav>
      <h2 className="principal__subtitulo" tabIndex={-1} ref={titulo}>
        {team.nombre}
      </h2>
      <p className="pantalla-de-team__datos">
        {seccion !== undefined && (
          <span>
            Team {posicion} de {seccion.teams.length} en «{seccion.grupo.nombre}»
          </span>
        )}
        {esPortadaDelGrupo && <span>portada del grupo</span>}
        <span>{ocupados.length}/4 Aniimo</span>
      </p>
      {seccion !== undefined && (
        <div
          className="pantalla-de-team__grupo"
          role="group"
          aria-label={`Teams del grupo «${seccion.grupo.nombre}»`}
        >
          {seccion.teams.map((delGrupo, indice) => (
            <button
              key={delGrupo.id}
              type="button"
              className="pantalla-de-team__salto"
              aria-current={delGrupo.id === team.id ? 'true' : undefined}
              onClick={() => delGrupo.id !== team.id && alCambiarDeTeam(delGrupo.id)}
            >
              {`${indice + 1} ${delGrupo.nombre}`}
            </button>
          ))}
        </div>
      )}
      <div className="pantalla-de-team__acciones">
        <label className="pantalla-de-team__visibilidad">
          <input
            type="checkbox"
            checked={team.ocultoParaAmigos}
            disabled={pendiente}
            onChange={(e) => void ejecutar(equipo.cambiarVisibilidad(teamId, e.target.checked))}
          />
          Oculto para amigos
        </label>
        {ocupados.length > 0 && (
          <button
            type="button"
            aria-expanded={eligiendoPortada}
            disabled={pendiente}
            onClick={() => setEligiendoPortada((actual) => !actual)}
          >
            Elegir portada
          </button>
        )}
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            setNombre(team.nombre)
            setMensaje(null)
            setEditando(true)
          }}
        >
          Renombrar
        </button>
        {seccion !== undefined ? (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => void ejecutar(equipo.sacarTeam(seccion.grupo.id, teamId))}
          >
            Sacar del grupo
          </button>
        ) : (
          <AgruparTeam
            opciones={opcionesDeGrupo(secciones, null)}
            deshabilitado={pendiente}
            alAgrupar={(grupoId) => equipo.agregarTeam(grupoId, teamId)}
          />
        )}
        <button type="button" disabled={pendiente || abriendo} onClick={() => void abrirEnOverlay()}>
          Abrir en overlay
        </button>
        <button
          type="button"
          className="pantalla-de-team__peligro"
          disabled={pendiente}
          onClick={() => {
            setMensaje(null)
            setConfirmando(true)
          }}
        >
          Borrar team
        </button>
      </div>
      {eligiendoPortada && ocupados.length > 0 && (
        <label className="pantalla-de-team__portada">
          Portada
          <select
            value={team.portadaSlot === null ? '' : String(team.portadaSlot)}
            disabled={pendiente}
            onChange={(e) =>
              void ejecutar(
                equipo.elegirPortadaDeTeam(teamId, e.target.value === '' ? null : Number(e.target.value))
              )
            }
          >
            <option value="">Automática</option>
            {ocupados.map((slot) => (
              <option key={slot.slot} value={String(slot.slot)}>
                {slot.aniimo?.nombre}
              </option>
            ))}
          </select>
        </label>
      )}
      {editando && (
        <form className="pantalla-de-team__renombrar" onSubmit={(e) => void guardarNombre(e)}>
          <label>
            Nuevo nombre
            <input
              type="text"
              value={nombre}
              disabled={pendiente}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <button type="submit" disabled={pendiente}>
            Guardar nombre
          </button>
          <button type="button" disabled={pendiente} onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      )}
      {confirmando && (
        <Confirmacion
          mensaje={`¿Borrar el team «${team.nombre}» y todos sus Aniimo?`}
          deshabilitado={pendiente}
          alConfirmar={() => void borrar()}
          alCancelar={() => setConfirmando(false)}
        />
      )}
      {mensaje !== null && (
        <p className="pantalla-de-team__mensaje" role="alert">
          {mensaje}
        </p>
      )}
      <div className="pantalla-de-team__cartas">
        {team.slots.map(({ slot, aniimo }) =>
          aniimo === null ? (
            <button
              key={slot}
              type="button"
              className="pantalla-de-team__vacio"
              disabled={pendiente}
              onClick={() => alAbrirSlot(teamId, slot)}
            >
              Agregar Aniimo
            </button>
          ) : (
            <button
              key={slot}
              type="button"
              className="pantalla-de-team__carta"
              disabled={pendiente}
              onClick={() => alAbrirSlot(teamId, slot)}
            >
              <CartaAniimo
                teamId={teamId}
                slot={slot}
                aniimo={aniimo}
                variante="team"
                esPortada={slot === team.portadaEfectivaSlot}
              />
            </button>
          )
        )}
      </div>
    </section>
  )
}
