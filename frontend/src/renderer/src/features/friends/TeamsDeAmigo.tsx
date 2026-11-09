import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { DuenioDeTeams, ErrorDeAmigos } from '../../../../shared/amigos'
import type { GrupoDeAmigo, TeamDeAmigo, TeamResumen } from '../../../../shared/teams'
import GrupoEnAbanico from '../mazo/GrupoEnAbanico'
import PilaDeTeam from '../mazo/PilaDeTeam'
import { useAbanicos } from '../mazo/useAbanicos'
import { useTeclasDelAbanico } from '../mazo/useTeclasDelAbanico'
import type { CargarImagenDeTarjeta } from '../teams/useImagenDeTarjeta'
import '../teams/teams.css'
import { mensajeDeErrorDeAmigos } from './mensajes'

interface TeamsDeAmigoProps {
  readonly amigo: DuenioDeTeams
  readonly grupoDesplegado?: string | null
  readonly alAbrirTeam: (teamId: string) => void
  readonly alVolver: () => void
  readonly alSinAcceso: () => void
  readonly alSesionVencida: () => void
}

type Estado =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly error: ErrorDeAmigos }
  | {
      readonly tipo: 'listo'
      readonly teams: readonly TeamDeAmigo[]
      readonly grupos: readonly GrupoDeAmigo[]
    }

const AYUDA_DE_TECLADO =
  'Pasá el puntero sobre un grupo, o enfocalo con Tab y apretá T, para desplegar sus teams. 1-5 abre un team · Esc cierra.'

function comoResumen(team: TeamDeAmigo): TeamResumen {
  return { ...team, ocultoParaAmigos: false, portadaEfectivaSlot: team.portadaSlot }
}

export default function TeamsDeAmigo({
  amigo,
  grupoDesplegado = null,
  alAbrirTeam,
  alVolver,
  alSinAcceso,
  alSesionVencida
}: TeamsDeAmigoProps): ReactElement {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [intento, setIntento] = useState(0)
  const abanicos = useAbanicos(grupoDesplegado)
  const avisos = useRef({ alSinAcceso, alSesionVencida })
  avisos.current = { alSinAcceso, alSesionVencida }

  useEffect(() => {
    let activo = true
    void window.aniimo.amigos.listarTeams({ usuarioId: amigo.id }).then((resultado) => {
      if (!activo) {
        return
      }
      if (resultado.ok) {
        setEstado({ tipo: 'listo', teams: resultado.teams, grupos: resultado.grupos })
      } else if (resultado.error === 'sesion-vencida') {
        avisos.current.alSesionVencida()
      } else if (resultado.error === 'no-encontrado') {
        avisos.current.alSinAcceso()
      } else {
        setEstado({ tipo: 'error', error: resultado })
      }
    })
    return () => {
      activo = false
    }
  }, [amigo.id, intento])

  function reintentar(): void {
    setEstado({ tipo: 'cargando' })
    setIntento((actual) => actual + 1)
  }

  const cargarImagen: CargarImagenDeTarjeta = useCallback(
    (teamId, slot) => window.aniimo.amigos.obtenerImagen({ usuarioId: amigo.id, teamId, slot }),
    [amigo.id]
  )

  const listo = estado.tipo === 'listo'
  const teams = estado.tipo === 'listo' ? estado.teams : []
  const grupos = estado.tipo === 'listo' ? [...estado.grupos].sort((a, b) => a.orden - b.orden) : []
  const sueltos = teams.filter((team) => team.grupoId === null).sort((a, b) => a.orden - b.orden)

  useTeclasDelAbanico({
    activo: listo,
    abanicos,
    teamIdsDe: (grupoId) => grupos.find((grupo) => grupo.id === grupoId)?.teamIds ?? [],
    alAbrirTeam
  })

  return (
    <section className="principal__seccion">
      <p className="amigos__rotulo">Solo lectura</p>
      <h2 className="principal__subtitulo" tabIndex={-1}>Teams de {amigo.nombreUsuario}</h2>
      <div>
        <button type="button" onClick={alVolver}>
          Volver a Amigos
        </button>
      </div>
      {estado.tipo === 'cargando' && <p className="lista-de-teams__estado">Cargando teams…</p>}
      {estado.tipo === 'error' && (
        <div className="lista-de-teams__estado">
          <p role="alert">{mensajeDeErrorDeAmigos(estado.error)}</p>
          <button type="button" onClick={reintentar}>
            Reintentar
          </button>
        </div>
      )}
      {listo && teams.length === 0 && (
        <p className="lista-de-teams__estado">
          {amigo.nombreUsuario} todavía no tiene teams para mostrar
        </p>
      )}
      {listo && (
        <div className="mazo">
          {grupos.length > 0 && (
            <>
              <p className="mazo__ayuda">{AYUDA_DE_TECLADO}</p>
              <h3 className="mazo__rotulo">Grupos</h3>
              <div className="mazo__grupos">
                {grupos.map((grupo) => (
                  <GrupoEnAbanico
                    key={grupo.id}
                    grupoId={grupo.id}
                    nombre={grupo.nombre}
                    teams={grupo.teamIds.flatMap((id) => {
                      const team = teams.find((candidato) => candidato.id === id)
                      return team === undefined ? [] : [comoResumen(team)]
                    })}
                    portadaTeamId={grupo.portadaTeamId}
                    abierto={abanicos.estaAbierto(grupo.id)}
                    alAlternar={() => abanicos.alternar(grupo.id)}
                    alEntrar={() => abanicos.entrar(grupo.id)}
                    alSalir={() => abanicos.salir(grupo.id)}
                    alAbrirTeam={alAbrirTeam}
                    teamDesplegado={abanicos.teamAbierto}
                    alEntrarTeam={abanicos.entrarTeam}
                    alSalirTeam={abanicos.salirTeam}
                    cargarImagen={cargarImagen}
                  />
                ))}
              </div>
            </>
          )}
          {sueltos.length > 0 && (
            <section className="mazo__sueltos" aria-labelledby="mazo-sueltos">
              <h3 className="mazo__rotulo" id="mazo-sueltos">
                Teams sueltos
              </h3>
              <div className="mazo__pilas">
                {sueltos.map((team) => (
                  <PilaDeTeam
                    key={team.id}
                    teamId={team.id}
                    nombre={team.nombre}
                    slots={team.slots}
                    portadaSlot={team.portadaSlot}
                    ocultoParaAmigos={false}
                    alAbrir={() => alAbrirTeam(team.id)}
                    desplegada={abanicos.teamAbierto === team.id}
                    alEntrar={() => abanicos.entrarTeam(team.id)}
                    alSalir={() => abanicos.salirTeam(team.id)}
                    cargarImagen={cargarImagen}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  )
}
