export const ARGUMENTO_SEGUNDO_PLANO = '--segundo-plano'

export interface ItemDelIcono {
  readonly etiqueta: string
  readonly alElegir: () => void
}

export interface DependenciasDeSegundoPlano {
  readonly empaquetado: boolean
  readonly inicioDeWindows: {
    readonly leer: () => boolean
    readonly poner: (opciones: { openAtLogin: boolean; args: string[] }) => void
  }
  readonly crearIcono: (menu: ItemDelIcono[]) => void
  readonly mostrarPrincipal: () => void
  readonly detener: () => void
  readonly salir: () => void
}

export interface SegundoPlano {
  readonly disponible: boolean
  leerInicio(): boolean
  ponerInicio(abrirAlIniciar: boolean): void
  asegurarIcono(): void
  alCerrarVentana(evento: { preventDefault(): void }, ventana: { hide(): void }): void
  debeSalirAlCerrarTodo(): boolean
  salirDeVerdad(): void
  marcarSaliendo(): void
}

export function arrancaEnSegundoPlano(argumentos: readonly string[], empaquetado: boolean): boolean {
  return empaquetado && argumentos.includes(ARGUMENTO_SEGUNDO_PLANO)
}

export function crearSegundoPlano(deps: DependenciasDeSegundoPlano): SegundoPlano {
  let hayIcono = false
  let saliendo = false

  function leerInicio(): boolean {
    return deps.empaquetado && deps.inicioDeWindows.leer()
  }

  function asegurarIcono(): void {
    if (!deps.empaquetado || hayIcono) {
      return
    }
    hayIcono = true
    deps.crearIcono([
      { etiqueta: 'Abrir Aniimo Team Tracker', alElegir: deps.mostrarPrincipal },
      { etiqueta: 'Salir', alElegir: salirDeVerdad }
    ])
  }

  function salirDeVerdad(): void {
    saliendo = true
    deps.detener()
    deps.salir()
  }

  return {
    disponible: deps.empaquetado,
    leerInicio,
    ponerInicio(abrirAlIniciar) {
      if (!deps.empaquetado) {
        return
      }
      deps.inicioDeWindows.poner({ openAtLogin: abrirAlIniciar, args: [ARGUMENTO_SEGUNDO_PLANO] })
      if (abrirAlIniciar) {
        asegurarIcono()
      }
    },
    asegurarIcono,
    alCerrarVentana(evento, ventana) {
      if (!saliendo && leerInicio()) {
        evento.preventDefault()
        ventana.hide()
      }
    },
    debeSalirAlCerrarTodo() {
      return !leerInicio()
    },
    salirDeVerdad,
    marcarSaliendo() {
      saliendo = true
    }
  }
}
