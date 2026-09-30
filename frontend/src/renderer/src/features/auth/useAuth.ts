import { useCallback, useEffect, useState } from 'react'
import type { Credenciales, ErrorDeAuth, ResultadoAuth } from '../../../../shared/auth'

export type EstadoAuth =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'anonimo'; readonly aviso: ErrorDeAuth | null }
  | { readonly tipo: 'autenticado'; readonly nombreUsuario: string }

export interface UseAuth {
  readonly estado: EstadoAuth
  iniciarSesion(credenciales: Credenciales): Promise<ErrorDeAuth | null>
  registrarse(credenciales: Credenciales): Promise<ErrorDeAuth | null>
  cerrarSesion(): Promise<void>
}

export function useAuth(): UseAuth {
  const [estado, setEstado] = useState<EstadoAuth>({ tipo: 'cargando' })

  useEffect(() => {
    let activo = true
    void window.aniimo.auth.obtenerSesion().then((resultado) => {
      if (!activo) {
        return
      }
      if (!resultado.ok) {
        setEstado({ tipo: 'anonimo', aviso: resultado })
      } else if (resultado.nombreUsuario === null) {
        setEstado({ tipo: 'anonimo', aviso: null })
      } else {
        setEstado({ tipo: 'autenticado', nombreUsuario: resultado.nombreUsuario })
      }
    })
    return () => {
      activo = false
    }
  }, [])

  const resolver = useCallback((resultado: ResultadoAuth): ErrorDeAuth | null => {
    if (resultado.ok) {
      setEstado({ tipo: 'autenticado', nombreUsuario: resultado.nombreUsuario })
      return null
    }
    if (resultado.error === 'sesion-vencida') {
      setEstado({ tipo: 'anonimo', aviso: resultado })
    }
    return resultado
  }, [])

  const iniciarSesion = useCallback(
    async (credenciales: Credenciales) => resolver(await window.aniimo.auth.iniciarSesion(credenciales)),
    [resolver]
  )

  const registrarse = useCallback(
    async (credenciales: Credenciales) => resolver(await window.aniimo.auth.registrarse(credenciales)),
    [resolver]
  )

  const cerrarSesion = useCallback(async () => {
    await window.aniimo.auth.cerrarSesion()
    setEstado({ tipo: 'anonimo', aviso: null })
  }, [])

  return { estado, iniciarSesion, registrarse, cerrarSesion }
}
