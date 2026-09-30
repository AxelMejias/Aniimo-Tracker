export interface DatosDeSesion {
  readonly token: string
  readonly nombreUsuario: string
}

export interface SesionEnMemoria {
  obtener(): DatosDeSesion | null
  guardar(token: string, nombreUsuario: string): void
  borrar(): void
}

export function crearSesionEnMemoria(): SesionEnMemoria {
  let actual: DatosDeSesion | null = null
  return {
    obtener: () => actual,
    guardar: (token, nombreUsuario) => {
      actual = { token, nombreUsuario }
    },
    borrar: () => {
      actual = null
    }
  }
}
