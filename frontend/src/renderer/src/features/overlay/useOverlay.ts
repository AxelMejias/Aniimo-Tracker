import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ficha, TeamResumen } from '../../../../shared/teams'

export type DatosDelOverlay =
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'sin-seleccion' }
  | { readonly tipo: 'no-existe' }
  | { readonly tipo: 'team'; readonly team: TeamResumen }

export interface FichaAbierta {
  readonly slot: number
  readonly ficha: Ficha
  readonly imagen: string | null
}

export interface UseOverlay {
  readonly datos: DatosDelOverlay
  readonly ficha: FichaAbierta | null
  readonly fallo: boolean
  actualizar(): Promise<void>
  abrirSlot(slot: number): Promise<void>
  volverAlTeam(): void
  cerrar(): void
}

export function useOverlay(): UseOverlay {
  const [datos, setDatos] = useState<DatosDelOverlay>({ tipo: 'cargando' })
  const [ficha, setFicha] = useState<FichaAbierta | null>(null)
  const [fallo, setFallo] = useState(false)
  const enVuelo = useRef<Promise<void> | null>(null)
  const slotAbierto = useRef<number | null>(null)
  const teamActual = useRef<string | null>(null)
  const activo = useRef(true)

  const cerrar = useCallback(() => {
    void window.aniimo.overlay.cerrar()
  }, [])

  const cerrarFicha = useCallback(() => {
    slotAbierto.current = null
    setFicha(null)
  }, [])

  const cargarFicha = useCallback(
    async (teamId: string, slot: number): Promise<void> => {
      const pedido = { teamId, slot }
      const [resultado, imagen] = await Promise.all([
        window.aniimo.teams.obtenerFicha(pedido),
        window.aniimo.teams.obtenerImagen(pedido)
      ])
      if (!activo.current) {
        return
      }
      if (!resultado.ok) {
        if (resultado.error === 'sesion-vencida') {
          cerrar()
        } else if (resultado.error === 'no-encontrado') {
          cerrarFicha()
          setDatos({ tipo: 'no-existe' })
        } else {
          setFallo(true)
        }
        return
      }
      if (!imagen.ok && imagen.error === 'sesion-vencida') {
        cerrar()
        return
      }
      if (resultado.ficha === null) {
        cerrarFicha()
        return
      }
      setFallo(false)
      setFicha({ slot, ficha: resultado.ficha, imagen: imagen.ok ? imagen.imagen : null })
    },
    [cerrar, cerrarFicha]
  )

  const leer = useCallback(async (): Promise<void> => {
    const seleccion = await window.aniimo.overlay.obtenerSeleccion()
    if (!activo.current) {
      return
    }
    if (!seleccion.ok) {
      setFallo(true)
      return
    }
    if (seleccion.seleccion === null) {
      teamActual.current = null
      cerrarFicha()
      setFallo(false)
      setDatos({ tipo: 'sin-seleccion' })
      return
    }
    const { teamId } = seleccion.seleccion
    const listado = await window.aniimo.teams.listar()
    if (!activo.current) {
      return
    }
    if (!listado.ok) {
      if (listado.error === 'sesion-vencida') {
        cerrar()
      } else {
        setFallo(true)
      }
      return
    }
    const team = listado.teams.find((candidato) => candidato.id === teamId)
    if (team === undefined) {
      teamActual.current = null
      cerrarFicha()
      setFallo(false)
      setDatos({ tipo: 'no-existe' })
      return
    }
    if (teamActual.current !== team.id) {
      cerrarFicha()
    }
    teamActual.current = team.id
    setFallo(false)
    setDatos({ tipo: 'team', team })
    if (slotAbierto.current !== null) {
      await cargarFicha(team.id, slotAbierto.current)
    }
  }, [cargarFicha, cerrar, cerrarFicha])

  const actualizar = useCallback((): Promise<void> => {
    enVuelo.current ??= leer().finally(() => {
      enVuelo.current = null
    })
    return enVuelo.current
  }, [leer])

  const abrirSlot = useCallback(
    async (slot: number): Promise<void> => {
      if (teamActual.current === null) {
        return
      }
      slotAbierto.current = slot
      await cargarFicha(teamActual.current, slot)
    },
    [cargarFicha]
  )

  useEffect(() => {
    activo.current = true
    const alEnfocar = (): void => {
      void actualizar()
    }
    void actualizar()
    window.addEventListener('focus', alEnfocar)
    return () => {
      activo.current = false
      window.removeEventListener('focus', alEnfocar)
    }
  }, [actualizar])

  return { datos, ficha, fallo, actualizar, abrirSlot, volverAlTeam: cerrarFicha, cerrar }
}
