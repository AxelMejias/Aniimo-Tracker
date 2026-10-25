import type { ResultadoOverlay, SeleccionDeOverlay } from '../../shared/overlay'
import { ajustarAPantallas, type Rect } from './limites'

export interface VentanaOverlay {
  show(): void
  focus(): void
  close(): void
  getBounds(): Rect
  on(evento: 'close' | 'closed', oyente: () => void): void
}

export interface DependenciasDelControlador {
  crearVentana(limites: Rect): VentanaOverlay
  leerLimites(): Promise<Rect | null>
  guardarLimites(limites: Rect): Promise<void>
  areasDePantalla(): { areas: readonly Rect[]; principal: Rect }
  haySesion(): boolean
}

export interface ControladorOverlay {
  abrir(teamId: string): Promise<ResultadoOverlay>
  cerrar(): void
  seleccion(): SeleccionDeOverlay | null
}

export function crearControladorOverlay(deps: DependenciasDelControlador): ControladorOverlay {
  let ventana: VentanaOverlay | null = null
  let seleccion: SeleccionDeOverlay | null = null
  let creando: Promise<void> | null = null

  async function crear(): Promise<void> {
    const guardados = await deps.leerLimites()
    if (seleccion === null) {
      return
    }
    const { areas, principal } = deps.areasDePantalla()
    const nueva = deps.crearVentana(ajustarAPantallas(guardados, areas, principal))
    ventana = nueva
    nueva.on('close', () => {
      void deps.guardarLimites(nueva.getBounds()).catch(() => undefined)
    })
    nueva.on('closed', () => {
      if (ventana === nueva) {
        ventana = null
        seleccion = null
      }
    })
  }

  return {
    async abrir(teamId) {
      if (!deps.haySesion()) {
        return { ok: false, error: 'sesion-vencida' }
      }
      seleccion = { teamId }
      if (ventana === null && creando === null) {
        creando = crear().finally(() => {
          creando = null
        })
        await creando
        return { ok: true }
      }
      if (creando !== null) {
        await creando
      }
      ventana?.show()
      ventana?.focus()
      return { ok: true }
    },
    cerrar() {
      const actual = ventana
      ventana = null
      seleccion = null
      actual?.close()
    },
    seleccion: () => seleccion
  }
}
