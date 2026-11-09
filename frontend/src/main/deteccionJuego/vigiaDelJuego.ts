const INTERVALO_MS = 5000
const FALTAS_PARA_CERRAR = 2

type Estado = 'apagado' | 'sin-juego' | 'con-juego'

export interface OpcionesDelVigia {
  readonly consultar: () => Promise<boolean>
  readonly alAbrirse: () => void
  readonly alCerrarse?: () => void
}

export interface Vigia {
  encender(): void
  apagar(): void
}

export function crearVigia({ consultar, alAbrirse, alCerrarse }: OpcionesDelVigia): Vigia {
  let estado: Estado = 'apagado'
  let timer: ReturnType<typeof setInterval> | null = null
  let enVuelo = false
  let faltas = 0

  async function sondear(): Promise<void> {
    if (enVuelo) {
      return
    }
    enVuelo = true
    let hayJuego = false
    try {
      hayJuego = await consultar()
    } catch {
      hayJuego = false
    }
    enVuelo = false

    if (estado === 'apagado') {
      return
    }
    if (hayJuego) {
      faltas = 0
      if (estado === 'sin-juego') {
        estado = 'con-juego'
        alAbrirse()
      }
      return
    }
    if (estado === 'con-juego') {
      faltas += 1
      if (faltas >= FALTAS_PARA_CERRAR) {
        estado = 'sin-juego'
        faltas = 0
        alCerrarse?.()
      }
    }
  }

  return {
    encender() {
      if (estado !== 'apagado') {
        return
      }
      estado = 'sin-juego'
      faltas = 0
      timer = setInterval(() => void sondear(), INTERVALO_MS)
      void sondear()
    },
    apagar() {
      estado = 'apagado'
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
  }
}
