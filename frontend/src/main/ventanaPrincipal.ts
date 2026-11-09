export interface VentanaDeLaApp {
  isDestroyed(): boolean
  showInactive(): void
}

export interface VentanaPrincipal<V extends VentanaDeLaApp> {
  abrir(mostrarAlCrear?: boolean): V
  actual(): V | null
  mostrarSinActivar(): void
}

export function crearVentanaPrincipal<V extends VentanaDeLaApp>(
  crear: (mostrarAlCrear: boolean) => V
): VentanaPrincipal<V> {
  let ventana: V | null = null

  function actual(): V | null {
    return ventana !== null && !ventana.isDestroyed() ? ventana : null
  }

  function abrir(mostrarAlCrear = true): V {
    ventana = crear(mostrarAlCrear)
    return ventana
  }

  return {
    abrir,
    actual,
    mostrarSinActivar() {
      // showInactive y nunca focus: el teclado tiene que seguir en el juego.
      const existente = actual() ?? abrir(false)
      existente.showInactive()
    }
  }
}
