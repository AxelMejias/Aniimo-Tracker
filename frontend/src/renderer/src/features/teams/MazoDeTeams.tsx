import type { ReactElement } from 'react'
import GrupoEnAbanico from '../mazo/GrupoEnAbanico'
import PilaDeTeam from '../mazo/PilaDeTeam'
import type { Abanicos } from '../mazo/useAbanicos'
import AgruparTeam from './AgruparTeam'
import ControlesDeGrupo from './ControlesDeGrupo'
import { opcionesDeGrupo, type Secciones } from './secciones'
import type { UseTeams } from './useTeams'

const AYUDA_DE_TECLADO =
  'Pasá el puntero sobre un grupo, o enfocalo con Tab y apretá T, para desplegar sus teams. 1-5 abre un team · Esc cierra.'

interface MazoDeTeamsProps {
  readonly secciones: Secciones
  readonly abanicos: Abanicos
  readonly equipo: UseTeams
  readonly alAbrirTeam: (teamId: string) => void
}

export default function MazoDeTeams({
  secciones,
  abanicos,
  equipo,
  alAbrirTeam
}: MazoDeTeamsProps): ReactElement {
  const { pendiente } = equipo
  const hayGrupos = secciones.grupos.length > 0

  return (
    <div className="mazo">
      {hayGrupos && (
        <>
          <p className="mazo__ayuda">{AYUDA_DE_TECLADO}</p>
          <h3 className="mazo__rotulo">Grupos</h3>
          <div className="mazo__grupos">
            {secciones.grupos.map((seccion) => {
              const { grupo, teams } = seccion
              return (
                <GrupoEnAbanico
                  key={grupo.id}
                  grupoId={grupo.id}
                  nombre={grupo.nombre}
                  teams={teams}
                  portadaTeamId={grupo.portadaEfectivaTeamId}
                  abierto={abanicos.estaAbierto(grupo.id)}
                  alAlternar={() => abanicos.alternar(grupo.id)}
                  alEntrar={() => abanicos.entrar(grupo.id)}
                  alSalir={() => abanicos.salir(grupo.id)}
                  alAbrirTeam={alAbrirTeam}
                  teamDesplegado={abanicos.teamAbierto}
                  alEntrarTeam={abanicos.entrarTeam}
                  alSalirTeam={abanicos.salirTeam}
                >
                  <ControlesDeGrupo
                    seccion={seccion}
                    deshabilitado={pendiente}
                    alRenombrar={(nuevo) => equipo.renombrarGrupo(grupo.id, nuevo)}
                    alElegirPortada={(teamId) => equipo.elegirPortadaDeGrupo(grupo.id, teamId)}
                  />
                </GrupoEnAbanico>
              )
            })}
          </div>
        </>
      )}
      {secciones.sueltos.length > 0 && (
        <section className="mazo__sueltos" aria-labelledby="mazo-sueltos">
          <h3 className="mazo__rotulo" id="mazo-sueltos">
            Teams sueltos
          </h3>
          <div className="mazo__pilas">
            {secciones.sueltos.map((team) => (
              <div className="suelto" role="group" aria-label={team.nombre} key={team.id}>
                <PilaDeTeam
                  teamId={team.id}
                  nombre={team.nombre}
                  slots={team.slots}
                  portadaSlot={team.portadaEfectivaSlot}
                  ocultoParaAmigos={team.ocultoParaAmigos}
                  alAbrir={() => alAbrirTeam(team.id)}
                  desplegada={abanicos.teamAbierto === team.id}
                  alEntrar={() => abanicos.entrarTeam(team.id)}
                  alSalir={() => abanicos.salirTeam(team.id)}
                />
                {hayGrupos && (
                  <AgruparTeam
                    opciones={opcionesDeGrupo(secciones, null)}
                    deshabilitado={pendiente}
                    alAgrupar={(grupoId) => equipo.agregarTeam(grupoId, team.id)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
