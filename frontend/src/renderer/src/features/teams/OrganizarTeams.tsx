import type { ReactElement } from 'react'
import { MAXIMO_DE_TEAMS_POR_GRUPO, type TeamResumen } from '../../../../shared/teams'
import ControlesDeOrganizarGrupo from './ControlesDeOrganizarGrupo'
import {
  destinoDeMovimiento,
  type Arrastrado,
  type Direccion
} from './destinoDeArrastre'
import FilaDeTeam from './FilaDeTeam'
import { opcionesDeGrupo, type Secciones } from './secciones'
import SeccionDeGrupo from './SeccionDeGrupo'
import type { UseArrastre } from './useArrastre'
import type { UseTeams } from './useTeams'

interface OrganizarTeamsProps {
  readonly secciones: Secciones
  readonly equipo: UseTeams
  readonly arrastre: UseArrastre
  readonly mensajeDe: (clave: string) => string | null
  readonly alMover: (arrastrado: Arrastrado, direccion: Direccion) => void
}

export default function OrganizarTeams({
  secciones,
  equipo,
  arrastre,
  mensajeDe,
  alMover
}: OrganizarTeamsProps): ReactElement {
  const { pendiente } = equipo

  function filaDe(team: TeamResumen): ReactElement {
    const origen: Arrastrado = { tipo: 'team', id: team.id }
    const objetivo = { tipo: 'team', id: team.id } as const
    return (
      <FilaDeTeam
        key={team.id}
        team={team}
        deshabilitado={pendiente}
        opcionesDeGrupo={opcionesDeGrupo(secciones, team.grupoId)}
        alCambiarGrupo={(grupoId) => equipo.cambiarDeGrupo(team, grupoId)}
        puedeSubir={destinoDeMovimiento(secciones, origen, 'subir') !== null}
        puedeBajar={destinoDeMovimiento(secciones, origen, 'bajar') !== null}
        alMover={(direccion) => alMover(origen, direccion)}
        esDestino={arrastre.esDestinoMarcado(objetivo)}
        propsDeLaFila={arrastre.propsDeDestino(objetivo)}
        propsDelEncabezado={arrastre.propsDeOrigen(origen)}
      />
    )
  }

  const objetivoSinGrupo = { tipo: 'sin-grupo' } as const

  return (
    <div className="organizar">
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
              <ControlesDeOrganizarGrupo
                id={grupo.id}
                nombre={grupo.nombre}
                deshabilitado={pendiente}
                puedeSubir={destinoDeMovimiento(secciones, origen, 'subir') !== null}
                puedeBajar={destinoDeMovimiento(secciones, origen, 'bajar') !== null}
                alBorrar={() => equipo.borrarGrupo(grupo.id)}
                alMover={(direccion) => alMover(origen, direccion)}
              />
            }
          >
            {seccion.teams.map(filaDe)}
          </SeccionDeGrupo>
        )
      })}
      {(secciones.grupos.length > 0 || secciones.sueltos.length > 0) && (
        <SeccionDeGrupo
          id="sin-grupo"
          nombre="Sin grupo"
          mensaje={mensajeDe('sin-grupo')}
          esDestino={arrastre.esDestinoMarcado(objetivoSinGrupo)}
          propsDeLaSeccion={arrastre.propsDeDestino(objetivoSinGrupo)}
        >
          {secciones.sueltos.map(filaDe)}
        </SeccionDeGrupo>
      )}
    </div>
  )
}
