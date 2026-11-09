import type { Preferencias } from '../../shared/preferencias'
import { tieneClaves } from '../teams/validacion'

export type LeerArchivo = (ruta: string) => Promise<string>
export type EscribirArchivo = (ruta: string, contenido: string) => Promise<void>

interface PreferenciasGuardadas {
  readonly abrirAppConElJuego: boolean
}

function sonPreferenciasGuardadas(valor: unknown): valor is PreferenciasGuardadas {
  return tieneClaves(valor, ['abrirAppConElJuego']) && typeof valor.abrirAppConElJuego === 'boolean'
}

export async function leerPreferencias(
  ruta: string,
  leer: LeerArchivo
): Promise<PreferenciasGuardadas> {
  try {
    const valor: unknown = JSON.parse(await leer(ruta))
    return sonPreferenciasGuardadas(valor)
      ? { abrirAppConElJuego: valor.abrirAppConElJuego }
      : { abrirAppConElJuego: false }
  } catch {
    return { abrirAppConElJuego: false }
  }
}

export async function guardarPreferencias(
  ruta: string,
  preferencias: Pick<Preferencias, 'abrirAppConElJuego'>,
  escribir: EscribirArchivo
): Promise<void> {
  try {
    await escribir(ruta, JSON.stringify({ abrirAppConElJuego: preferencias.abrirAppConElJuego }))
  } catch {
    // Si no se puede escribir, la opcion queda como estaba al reiniciar.
  }
}
