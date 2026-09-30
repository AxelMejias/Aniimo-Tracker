import { useCallback, useEffect, useRef, useState } from 'react'
import type { ErrorDeTeams, TeamResumen } from '../../../../shared/teams'

export type EstadoDeTeams =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'error'; readonly error: ErrorDeTeams }
  | { readonly tipo: 'listo'; readonly teams: readonly TeamResumen[] }

export interface UseTeams {
  readonly estado: EstadoDeTeams
  readonly pendiente: boolean
  recargar(): Promise<void>
  crear(nombre: string): Promise<ErrorDeTeams | null>
  renombrar(teamId: string, nombre: string): Promise<ErrorDeTeams | null>
  borrar(teamId: string): Promise<ErrorDeTeams | null>
}

export function useTeams(alSesionVencida: () => void): UseTeams {
  const [estado, setEstado] = useState<EstadoDeTeams>({ tipo: 'cargando' })
  const [pendiente, setPendiente] = useState(false)
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  const recargar = useCallback(async () => {
    const resultado = await window.aniimo.teams.listar()
    if (resultado.ok) {
      setEstado({ tipo: 'listo', teams: resultado.teams })
    } else if (resultado.error === 'sesion-vencida') {
      sesionVencida.current()
    } else {
      setEstado({ tipo: 'error', error: resultado })
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  // La vista solo cambia con la respuesta del backend: se ejecuta la accion y se vuelve a pedir la lista.
  const ejecutar = useCallback(
    async (accion: () => Promise<{ readonly ok: true } | ErrorDeTeams>) => {
      setPendiente(true)
      try {
        const resultado = await accion()
        if (!resultado.ok) {
          if (resultado.error === 'sesion-vencida') {
            sesionVencida.current()
          }
          return resultado
        }
        await recargar()
        return null
      } finally {
        setPendiente(false)
      }
    },
    [recargar]
  )

  const crear = useCallback(
    (nombre: string) => ejecutar(() => window.aniimo.teams.crear({ nombre })),
    [ejecutar]
  )
  const renombrar = useCallback(
    (teamId: string, nombre: string) =>
      ejecutar(() => window.aniimo.teams.renombrar({ teamId, nombre })),
    [ejecutar]
  )
  const borrar = useCallback(
    (teamId: string) => ejecutar(() => window.aniimo.teams.borrar({ teamId })),
    [ejecutar]
  )

  return { estado, pendiente, recargar, crear, renombrar, borrar }
}
