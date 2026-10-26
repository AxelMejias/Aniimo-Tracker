import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import type { ErrorDeOverlay } from '../../../../shared/overlay'
import {
  MAXIMO_DE_TEAMS,
  MAXIMO_DE_TEAMS_POR_GRUPO,
  type ErrorDeTeams,
  type TeamResumen
} from '../../../../shared/teams'
import ControlesDeGrupo from './ControlesDeGrupo'
import { idDeBotonDeOrden } from './ControlesDeOrden'
import {
  destinoDeMovimiento,
  type Arrastrado,
  type Destino,
  type Direccion
} from './destinoDeArrastre'
import { mensajeDeErrorDeNombreDeTeam, mensajeDeErrorDeTeams } from './mensajes'
import NuevoGrupo from './NuevoGrupo'
import { armarSecciones, type Secciones } from './secciones'
import SeccionDeGrupo from './SeccionDeGrupo'
import TarjetaTeam from './TarjetaTeam'
import { useArrastre } from './useArrastre'
import { useTeams } from './useTeams'
import './teams.css'

const TEXTO_SIN_TEAMS = `Todavía no tenés teams. Creá el primero (podés tener hasta ${MAXIMO_DE_TEAMS}).`
const TEXTO_MAXIMO_DE_TEAMS = `Llegaste al máximo de ${MAXIMO_DE_TEAMS} teams.`
const SIN_SECCIONES: Secciones = { grupos: [], sueltos: [] }

interface ListaDeTeamsProps {
  readonly alAbrirSlot: (teamId: string, slot: number) => void
  readonly alSesionVencida: () => void
}

interface MensajeDeOrden {
  readonly clave: string
  readonly texto: string
}

interface FocoPendiente {
  readonly arrastrado: Arrastrado
  readonly direccion: Direccion
}

function nombrePropuesto(teams: readonly TeamResumen[]): string {
  const ocupadas = new Set(teams.map((team) => team.orden))
  for (let orden = 1; orden <= MAXIMO_DE_TEAMS; orden += 1) {
    if (!ocupadas.has(orden)) {
      return `Team ${orden}`
    }
  }
  return `Team ${MAXIMO_DE_TEAMS}`
}

function claveDelMensaje(destino: Destino): string {
  switch (destino.tipo) {
    case 'ordenar-grupos':
      return 'grupos'
    case 'ordenar-teams':
    case 'agregar':
      return destino.grupoId
    case 'ordenar-sueltos':
    case 'sacar':
      return 'sin-grupo'
  }
}

export default function ListaDeTeams({
  alAbrirSlot,
  alSesionVencida
}: ListaDeTeamsProps): ReactElement {
  const equipo = useTeams(alSesionVencida)
  const { estado, pendiente, recargar } = equipo
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [mensajeDeOrden, setMensajeDeOrden] = useState<MensajeDeOrden | null>(null)
  const [foco, setFoco] = useState<FocoPendiente | null>(null)

  const secciones =
    estado.tipo === 'listo' ? armarSecciones(estado.teams, estado.grupos) : SIN_SECCIONES

  function ejecutarDestino(destino: Destino): Promise<ErrorDeTeams | null> {
    switch (destino.tipo) {
      case 'ordenar-grupos':
        return equipo.ordenarGrupos(destino.grupoIds)
      case 'ordenar-teams':
        return equipo.ordenarTeamsDelGrupo(destino.grupoId, destino.teamIds)
      case 'ordenar-sueltos':
        return equipo.ordenarSueltos(destino.teamIds)
      case 'agregar':
        return equipo.agregarTeam(destino.grupoId, destino.teamId)
      case 'sacar':
        return equipo.sacarTeam(destino.grupoId, destino.teamId)
    }
  }

  async function aplicar(destino: Destino, despues?: FocoPendiente): Promise<void> {
    setMensajeDeOrden(null)
    const error = await ejecutarDestino(destino)
    if (error === null) {
      if (despues !== undefined) {
        setFoco(despues)
      }
      return
    }
    setMensajeDeOrden({ clave: claveDelMensaje(destino), texto: mensajeDeErrorDeTeams(error) })
    if (error.error === 'conflicto' || error.error === 'no-encontrado') {
      void recargar()
    }
  }

  const arrastre = useArrastre(secciones, pendiente, (destino) => void aplicar(destino))

  function mover(arrastrado: Arrastrado, direccion: Direccion): void {
    const destino = destinoDeMovimiento(secciones, arrastrado, direccion)
    if (destino !== null) {
      void aplicar(destino, { arrastrado, direccion })
    }
  }

  useEffect(() => {
    if (foco === null || pendiente) {
      return
    }
    const { tipo, id } = foco.arrastrado
    const otra = foco.direccion === 'subir' ? 'bajar' : 'subir'
    const usado = document.getElementById(idDeBotonDeOrden(tipo, id, foco.direccion))
    const otro = document.getElementById(idDeBotonDeOrden(tipo, id, otra))
    if (usado instanceof HTMLButtonElement && !usado.disabled) {
      usado.focus()
    } else {
      otro?.focus()
    }
    setFoco(null)
  }, [foco, pendiente, estado])

  async function abrirEnOverlay(teamId: string): Promise<ErrorDeOverlay | null> {
    const resultado = await window.aniimo.overlay.abrir({ teamId })
    if (resultado.ok) {
      return null
    }
    if (resultado.error === 'sesion-vencida') {
      alSesionVencida()
    }
    return resultado
  }

  if (estado.tipo === 'cargando') {
    return <p className="lista-de-teams__estado">Cargando teams…</p>
  }
  if (estado.tipo === 'error') {
    return (
      <div className="lista-de-teams__estado">
        <p role="alert">{mensajeDeErrorDeTeams(estado.error)}</p>
        <button type="button" onClick={() => void recargar()}>
          Reintentar
        </button>
      </div>
    )
  }

  const { teams, grupos } = estado
  const hayGrupos = secciones.grupos.length > 0
  const mensajeDe = (clave: string): string | null =>
    mensajeDeOrden?.clave === clave ? mensajeDeOrden.texto : null

  function abrirFormulario(): void {
    setNombre(nombrePropuesto(teams))
    setMensaje(null)
    setCreando(true)
  }

  async function confirmarCreacion(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const error = await equipo.crear(nombre)
    if (error === null) {
      setCreando(false)
      setMensaje(null)
    } else {
      setMensaje(mensajeDeErrorDeNombreDeTeam(error))
    }
  }

  async function cambiarDeGrupo(team: TeamResumen, grupoId: string | null): Promise<ErrorDeTeams | null> {
    if (grupoId !== null) {
      return equipo.agregarTeam(grupoId, team.id)
    }
    return team.grupoId === null ? null : equipo.sacarTeam(team.grupoId, team.id)
  }

  function tarjetaDe(team: TeamResumen): ReactElement {
    const opcionesDeGrupo = secciones.grupos
      .filter(
        ({ grupo, teams: delGrupo }) =>
          grupo.id === team.grupoId || delGrupo.length < MAXIMO_DE_TEAMS_POR_GRUPO
      )
      .map(({ grupo }) => ({ id: grupo.id, nombre: grupo.nombre }))
    const origen: Arrastrado = { tipo: 'team', id: team.id }
    const objetivo = { tipo: 'team', id: team.id } as const
    return (
      <TarjetaTeam
        key={team.id}
        team={team}
        deshabilitado={pendiente}
        alRenombrar={(nuevo) => equipo.renombrar(team.id, nuevo)}
        alCambiarVisibilidad={(oculto) => equipo.cambiarVisibilidad(team.id, oculto)}
        alBorrar={() => equipo.borrar(team.id)}
        alAbrirSlot={alAbrirSlot}
        alAbrirEnOverlay={() => abrirEnOverlay(team.id)}
        opcionesDeGrupo={opcionesDeGrupo}
        alCambiarGrupo={(grupoId) => cambiarDeGrupo(team, grupoId)}
        alElegirPortada={(slot) => equipo.elegirPortadaDeTeam(team.id, slot)}
        puedeSubir={destinoDeMovimiento(secciones, origen, 'subir') !== null}
        puedeBajar={destinoDeMovimiento(secciones, origen, 'bajar') !== null}
        alMover={(direccion) => mover(origen, direccion)}
        esDestino={arrastre.esDestinoMarcado(objetivo)}
        propsDeLaTarjeta={arrastre.propsDeDestino(objetivo)}
        propsDelEncabezado={arrastre.propsDeOrigen(origen)}
      />
    )
  }

  const objetivoSinGrupo = { tipo: 'sin-grupo' } as const

  return (
    <div className="lista-de-teams">
      <div className="lista-de-teams__barra">
        <p className="lista-de-teams__contador">
          {teams.length}/{MAXIMO_DE_TEAMS} teams
        </p>
        {teams.length < MAXIMO_DE_TEAMS &&
          (creando ? (
            <form className="lista-de-teams__crear" onSubmit={(e) => void confirmarCreacion(e)}>
              <label>
                Nombre del team
                <input
                  type="text"
                  value={nombre}
                  disabled={pendiente}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </label>
              <button type="submit" disabled={pendiente}>
                Crear
              </button>
              <button type="button" disabled={pendiente} onClick={() => setCreando(false)}>
                Cancelar
              </button>
              {mensaje !== null && (
                <p className="lista-de-teams__mensaje" role="alert">
                  {mensaje}
                </p>
              )}
            </form>
          ) : (
            <button
              className="lista-de-teams__nuevo"
              type="button"
              disabled={pendiente}
              onClick={abrirFormulario}
            >
              Crear team
            </button>
          ))}
        <NuevoGrupo
          cantidadDeGrupos={grupos.length}
          deshabilitado={pendiente}
          alCrear={equipo.crearGrupo}
        />
      </div>
      {teams.length === 0 && <p className="lista-de-teams__estado">{TEXTO_SIN_TEAMS}</p>}
      {teams.length >= MAXIMO_DE_TEAMS && (
        <p className="lista-de-teams__estado">{TEXTO_MAXIMO_DE_TEAMS}</p>
      )}
      {mensajeDe('grupos') !== null && (
        <p className="lista-de-teams__mensaje" role="alert">
          {mensajeDe('grupos')}
        </p>
      )}
      {secciones.grupos.map((seccion) => {
        const { grupo } = seccion
        const origen: Arrastrado = { tipo: 'grupo', id: grupo.id }
        const objetivo = { tipo: 'grupo', id: grupo.id } as const
        return (
          <SeccionDeGrupo
            key={grupo.id}
            id={grupo.id}
            nombre={grupo.nombre}
            cantidad={`${seccion.teams.length}/${MAXIMO_DE_TEAMS_POR_GRUPO} teams`}
            mensaje={mensajeDe(grupo.id)}
            esDestino={arrastre.esDestinoMarcado(objetivo)}
            propsDeLaSeccion={arrastre.propsDeDestino(objetivo)}
            propsDelEncabezado={arrastre.propsDeOrigen(origen)}
            acciones={
              <ControlesDeGrupo
                seccion={seccion}
                deshabilitado={pendiente}
                puedeSubir={destinoDeMovimiento(secciones, origen, 'subir') !== null}
                puedeBajar={destinoDeMovimiento(secciones, origen, 'bajar') !== null}
                alRenombrar={(nuevo) => equipo.renombrarGrupo(grupo.id, nuevo)}
                alElegirPortada={(teamId) => equipo.elegirPortadaDeGrupo(grupo.id, teamId)}
                alBorrar={() => equipo.borrarGrupo(grupo.id)}
                alMover={(direccion) => mover(origen, direccion)}
              />
            }
          >
            {seccion.teams.map(tarjetaDe)}
          </SeccionDeGrupo>
        )
      })}
      {(hayGrupos || secciones.sueltos.length > 0) && (
        <SeccionDeGrupo
          id="sin-grupo"
          nombre="Sin grupo"
          mensaje={mensajeDe('sin-grupo')}
          esDestino={arrastre.esDestinoMarcado(objetivoSinGrupo)}
          propsDeLaSeccion={arrastre.propsDeDestino(objetivoSinGrupo)}
        >
          {secciones.sueltos.map(tarjetaDe)}
        </SeccionDeGrupo>
      )}
    </div>
  )
}
