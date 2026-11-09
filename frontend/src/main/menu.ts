interface MenuDeLaAplicacion {
  setApplicationMenu(menu: null): void
}

// En desarrollo se conserva el menu por las DevTools.
export function quitarMenuDeLaAplicacion(menu: MenuDeLaAplicacion, empaquetada: boolean): void {
  if (empaquetada) {
    menu.setApplicationMenu(null)
  }
}
