import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import type { DuenioDeTeams } from '../../../shared/amigos'
import FichaAniimo from '../features/aniimo/FichaAniimo'
import type { Recodificador } from '../features/aniimo/recodificarImagen'
import { ProveedorDeAmigos, useEstadoDeAmigos } from '../features/friends/EstadoDeAmigos'
import FichaDeAmigo from '../features/friends/FichaDeAmigo'
import { MENSAJE_SIN_ACCESO } from '../features/friends/mensajes'
import TeamsDeAmigo from '../features/friends/TeamsDeAmigo'
import AmigosPage from './AmigosPage'
import ComparacionPage, { type LadoInicial } from './ComparacionPage'
import Confirmacion from '../shared/components/Confirmacion'
import MisTeamsPage from './MisTeamsPage'
import './Principal.css'

interface PrincipalProps {
  readonly nombreUsuario: string
  readonly alCerrarSesion: () => void
  readonly alSesionVencida: () => void
  readonly recodificar?: Recodificador
}

const MENSAJE_FICHA_GUARDADA = 'Ficha guardada'

type Seccion = 'teams' | 'amigos' | 'comparar'

type Vista =
  | { readonly tipo: 'teams' }
  | { readonly tipo: 'ficha-propia'; readonly teamId: string; readonly slot: number }
  | { readonly tipo: 'amigos' }
  | { readonly tipo: 'teams-de-amigo'; readonly amigo: DuenioDeTeams }
  | {
      readonly tipo: 'ficha-de-amigo'
      readonly amigo: DuenioDeTeams
      readonly teamId: string
      readonly slot: number
    }
  | { readonly tipo: 'comparar'; readonly derecho?: LadoInicial }

const SECCIONES: readonly { readonly codigo: Seccion; readonly etiqueta: string }[] = [
  { codigo: 'teams', etiqueta: 'Mis teams' },
  { codigo: 'amigos', etiqueta: 'Amigos' },
  { codigo: 'comparar', etiqueta: 'Comparar' }
]

function seccionDe(vista: Vista): Seccion {
  switch (vista.tipo) {
    case 'teams':
    case 'ficha-propia':
      return 'teams'
    case 'amigos':
    case 'teams-de-amigo':
    case 'ficha-de-amigo':
      return 'amigos'
    case 'comparar':
      return 'comparar'
  }
}

function Contenido({
  nombreUsuario,
  alCerrarSesion,
  alSesionVencida,
  recodificar
}: PrincipalProps): ReactElement {
  const [vista, setVista] = useState<Vista>({ tipo: 'teams' })
  const [aviso, setAviso] = useState<string | null>(null)
  const [hayCambios, setHayCambios] = useState(false)
  const [salidaPendiente, setSalidaPendiente] = useState<{ readonly continuar: () => void } | null>(
    null
  )
  const contenido = useRef<HTMLDivElement>(null)
  const primeraVista = useRef(true)
  const { recibidas, refrescar } = useEstadoDeAmigos()

  useEffect(() => {
    void refrescar()
  }, [refrescar])

  useEffect(() => {
    if (primeraVista.current) {
      primeraVista.current = false
      return
    }
    const destino = contenido.current?.querySelector<HTMLElement>('h2') ?? contenido.current
    destino?.focus()
  }, [vista])

  function navegar(siguiente: Vista, mensaje: string | null = null): void {
    setVista(siguiente)
    setAviso(mensaje)
    setHayCambios(false)
    setSalidaPendiente(null)
    void refrescar()
  }

  function salirSiNoHayCambios(continuar: () => void): void {
    if (hayCambios) {
      setSalidaPendiente({ continuar })
    } else {
      continuar()
    }
  }

  const cambiarSinGuardar = useCallback((hay: boolean): void => setHayCambios(hay), [])

  const sinAcceso = (): void => navegar({ tipo: 'amigos' }, MENSAJE_SIN_ACCESO)
  const activa = seccionDe(vista)
  const solicitudes = recibidas.length

  return (
    <main className="principal">
      <header className="principal__encabezado">
        <h1 className="principal__titulo">Aniimo Team Tracker</h1>
        <p className="principal__usuario">
          Sesión iniciada como <span className="principal__nombre">{nombreUsuario}</span>
        </p>
        <button type="button" onClick={() => salirSiNoHayCambios(alCerrarSesion)}>
          Cerrar sesión
        </button>
      </header>
      <nav className="principal__navegacion" aria-label="Secciones">
        {SECCIONES.map(({ codigo, etiqueta }) => (
          <span className="principal__item" key={codigo}>
            <button
              type="button"
              aria-current={activa === codigo ? 'page' : undefined}
              onClick={() => salirSiNoHayCambios(() => navegar({ tipo: codigo }))}
            >
              {etiqueta}
            </button>
            {codigo === 'amigos' && solicitudes > 0 && (
              <span className="principal__contador">Solicitudes ({solicitudes})</span>
            )}
          </span>
        ))}
      </nav>
      {aviso !== null && (
        <p className="principal__aviso" role="status">
          {aviso}
        </p>
      )}
      {salidaPendiente !== null && (
        <Confirmacion
          mensaje="¿Descartar los cambios de la ficha?"
          etiquetaConfirmar="Descartar cambios"
          deshabilitado={false}
          alConfirmar={() => salidaPendiente.continuar()}
          alCancelar={() => setSalidaPendiente(null)}
        />
      )}
      <div className="principal__contenido" ref={contenido} tabIndex={-1}>
        {vista.tipo === 'teams' && (
          <MisTeamsPage
            alAbrirSlot={(teamId, slot) => navegar({ tipo: 'ficha-propia', teamId, slot })}
            alSesionVencida={alSesionVencida}
          />
        )}
        {vista.tipo === 'ficha-propia' && (
          <FichaAniimo
            teamId={vista.teamId}
            slot={vista.slot}
            alVolver={(guardada) =>
              navegar({ tipo: 'teams' }, guardada ? MENSAJE_FICHA_GUARDADA : null)
            }
            alCambiarSinGuardar={cambiarSinGuardar}
            alSesionVencida={alSesionVencida}
            {...(recodificar === undefined ? {} : { recodificar })}
          />
        )}
        {vista.tipo === 'amigos' && (
          <AmigosPage
            nombreUsuario={nombreUsuario}
            alVerTeams={(amigo) =>
              navegar({
                tipo: 'teams-de-amigo',
                amigo: { id: amigo.id, nombreUsuario: amigo.nombreUsuario }
              })
            }
            alSesionVencida={alSesionVencida}
          />
        )}
        {vista.tipo === 'teams-de-amigo' && (
          <TeamsDeAmigo
            amigo={vista.amigo}
            alAbrirSlot={(teamId, slot) =>
              navegar({ tipo: 'ficha-de-amigo', amigo: vista.amigo, teamId, slot })
            }
            alVolver={() => navegar({ tipo: 'amigos' })}
            alSinAcceso={sinAcceso}
            alSesionVencida={alSesionVencida}
          />
        )}
        {vista.tipo === 'ficha-de-amigo' && (
          <FichaDeAmigo
            amigo={vista.amigo}
            teamId={vista.teamId}
            slot={vista.slot}
            alVolver={() => navegar({ tipo: 'teams-de-amigo', amigo: vista.amigo })}
            alComparar={() =>
              navegar({
                tipo: 'comparar',
                derecho: {
                  usuarioId: vista.amigo.id,
                  nombreUsuario: vista.amigo.nombreUsuario,
                  teamId: vista.teamId,
                  slot: vista.slot
                }
              })
            }
            alSinAcceso={sinAcceso}
            alSesionVencida={alSesionVencida}
          />
        )}
        {vista.tipo === 'comparar' && (
          <ComparacionPage
            {...(vista.derecho === undefined ? {} : { derecho: vista.derecho })}
            alSesionVencida={alSesionVencida}
          />
        )}
      </div>
    </main>
  )
}

export default function Principal(props: PrincipalProps): ReactElement {
  return (
    <ProveedorDeAmigos alSesionVencida={props.alSesionVencida}>
      <Contenido {...props} />
    </ProveedorDeAmigos>
  )
}
