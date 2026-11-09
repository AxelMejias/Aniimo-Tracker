import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { useAbanicos } from '../mazo/useAbanicos'
import { useTeclasDelAbanico } from '../mazo/useTeclasDelAbanico'
import {
  MAXIMO_DE_GRUPOS,
  MAXIMO_DE_TEAMS,
  type ErrorDeTeams,
  type TeamResumen
} from '../../../../shared/teams'
import { idDeBotonDeOrden } from './ControlesDeOrden'
import {
  destinoDeMovimiento,
  type Arrastrado,
  type Destino,
  type Direccion
} from './destinoDeArrastre'
import { mensajeDeErrorDeNombreDeTeam, mensajeDeErrorDeTeams } from './mensajes'
import MazoDeTeams from './MazoDeTeams'
import NuevoGrupo from './NuevoGrupo'
import OrganizarTeams from './OrganizarTeams'
import { armarSecciones, type Secciones } from './secciones'
import { useArrastre } from './useArrastre'
import { useTeams } from './useTeams'
import './teams.css'

const TEXTO_SIN_TEAMS = `Todavía no tenés teams. Creá el primero (podés tener hasta ${MAXIMO_DE_TEAMS}).`
const TEXTO_MAXIMO_DE_TEAMS = `Llegaste al máximo de ${MAXIMO_DE_TEAMS} teams.`
const SIN_SECCIONES: Secciones = { grupos: [], sueltos: [] }

interface ListaDeTeamsProps {
  readonly grupoDesplegado?: string | null
  readonly alAbrirTeam: (teamId: string) => void
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
  grupoDesplegado = null,
  alAbrirTeam,
  alSesionVencida
}: ListaDeTeamsProps): ReactElement {
  const equipo = useTeams(alSesionVencida)
  const { estado, pendiente, recargar } = equipo
  const [organizando, setOrganizando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [mensajeDeOrden, setMensajeDeOrden] = useState<MensajeDeOrden | null>(null)
  const [foco, setFoco] = useState<FocoPendiente | null>(null)
  const abanicos = useAbanicos(grupoDesplegado)

  const secciones =
    estado.tipo === 'listo' ? armarSecciones(estado.teams, estado.grupos) : SIN_SECCIONES

  useTeclasDelAbanico({
    activo: !organizando && estado.tipo === 'listo',
    abanicos,
    teamIdsDe: (grupoId) =>
      secciones.grupos.find(({ grupo }) => grupo.id === grupoId)?.teams.map((team) => team.id) ?? [],
    alAbrirTeam
  })

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

  function alternarOrganizar(): void {
    abanicos.plegar()
    setOrganizando((actual) => !actual)
  }

  return (
    <div className="lista-de-teams">
      <div className="lista-de-teams__barra">
        <p className="lista-de-teams__contador">
          <strong>
            {teams.length}/{MAXIMO_DE_TEAMS} teams
          </strong>{' '}
          · {grupos.length} de {MAXIMO_DE_GRUPOS} grupos · {secciones.sueltos.length}{' '}
          {secciones.sueltos.length === 1 ? 'team suelto' : 'teams sueltos'}
        </p>
        <div className="lista-de-teams__acciones">
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
                Nuevo team
              </button>
            ))}
          <NuevoGrupo
            cantidadDeGrupos={grupos.length}
            deshabilitado={pendiente}
            alCrear={equipo.crearGrupo}
          />
          <button type="button" aria-pressed={organizando} onClick={alternarOrganizar}>
            Organizar
          </button>
          {organizando && (
            <button type="button" onClick={alternarOrganizar}>
              Listo
            </button>
          )}
        </div>
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
      {organizando ? (
        <OrganizarTeams
          secciones={secciones}
          equipo={equipo}
          arrastre={arrastre}
          mensajeDe={mensajeDe}
          alMover={mover}
        />
      ) : (
        <MazoDeTeams secciones={secciones} abanicos={abanicos} equipo={equipo} alAbrirTeam={alAbrirTeam} />
      )}
    </div>
  )
}
