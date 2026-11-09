import type { ClaveDePreferencia, Preferencias } from '../../shared/preferencias'

export interface OpcionesDelServicio {
  readonly leerGuardadas: () => Promise<Pick<Preferencias, 'abrirAppConElJuego'>>
  readonly guardar: (preferencias: Pick<Preferencias, 'abrirAppConElJuego'>) => Promise<void>
  readonly vigia: { readonly encender: () => void; readonly apagar: () => void }
  readonly segundoPlano: {
    readonly disponible: boolean
    readonly leerInicio: () => boolean
    readonly ponerInicio: (abrirAlIniciar: boolean) => void
  }
}

export interface ServicioDePreferencias {
  iniciar(): Promise<void>
  obtener(): Promise<Preferencias>
  cambiar(clave: ClaveDePreferencia, valor: boolean): Promise<Preferencias>
}

export function crearServicioDePreferencias({
  leerGuardadas,
  guardar,
  vigia,
  segundoPlano
}: OpcionesDelServicio): ServicioDePreferencias {
  let abrirAppConElJuego = false

  async function obtener(): Promise<Preferencias> {
    return {
      abrirAppConElJuego,
      arrancarConWindows: segundoPlano.disponible && segundoPlano.leerInicio(),
      segundoPlanoDisponible: segundoPlano.disponible
    }
  }

  return {
    async iniciar() {
      abrirAppConElJuego = (await leerGuardadas()).abrirAppConElJuego
      if (abrirAppConElJuego) {
        vigia.encender()
      }
    },
    obtener,
    async cambiar(clave, valor) {
      if (clave === 'abrirAppConElJuego') {
        abrirAppConElJuego = valor
        await guardar({ abrirAppConElJuego })
        if (valor) {
          vigia.encender()
        } else {
          vigia.apagar()
        }
      } else if (segundoPlano.disponible) {
        segundoPlano.ponerInicio(valor)
      }
      return obtener()
    }
  }
}
