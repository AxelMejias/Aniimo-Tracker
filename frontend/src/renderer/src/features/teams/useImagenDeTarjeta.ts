import { useEffect, useState } from 'react'

export function useImagenDeTarjeta(
  teamId: string,
  slot: number,
  tieneImagen: boolean
): string | null {
  const [imagen, setImagen] = useState<string | null>(null)

  useEffect(() => {
    if (!tieneImagen) {
      setImagen(null)
      return
    }
    let activo = true
    void window.aniimo.teams.obtenerImagen({ teamId, slot }).then((resultado) => {
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
