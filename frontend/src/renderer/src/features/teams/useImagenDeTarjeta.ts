import { useEffect, useRef, useState } from 'react'

export type ResultadoDeImagenDeTarjeta =
  | { readonly ok: true; readonly imagen: string | null }
  | { readonly ok: false }

export type CargarImagenDeTarjeta = (
  teamId: string,
  slot: number
) => Promise<ResultadoDeImagenDeTarjeta>

export const cargarImagenPropia: CargarImagenDeTarjeta = (teamId, slot) =>
  window.aniimo.teams.obtenerImagen({ teamId, slot })

export function useImagenDeTarjeta(
  teamId: string,
  slot: number,
  tieneImagen: boolean,
  cargar: CargarImagenDeTarjeta = cargarImagenPropia
): string | null {
  const [imagen, setImagen] = useState<string | null>(null)
  const cargador = useRef(cargar)
  cargador.current = cargar

  useEffect(() => {
    if (!tieneImagen) {
      setImagen(null)
      return
    }
    let activo = true
    void cargador.current(teamId, slot).then((resultado) => {
      if (activo) {
        setImagen(resultado.ok ? resultado.imagen : null)
      }
    })
    return () => {
      activo = false
    }
  }, [teamId, slot, tieneImagen])

  return imagen
}
