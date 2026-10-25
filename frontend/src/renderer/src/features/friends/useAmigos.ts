import { useCallback, useRef, useState } from 'react'
import {
  PATRON_DE_NOMBRE_DE_USUARIO,
  type Amigo,
  type ErrorDeAmigos,
  type Solicitud,
  type UsuarioEncontrado
} from '../../../../shared/amigos'
import { useEstadoDeAmigos } from './EstadoDeAmigos'
import { MENSAJE_NOMBRE_DE_USUARIO_INVALIDO, mensajeDeErrorDeAmigos } from './mensajes'

export interface UseAmigos {
  readonly amigos: readonly Amigo[]
  readonly recibidas: readonly Solicitud[]
  readonly enviadas: readonly Solicitud[]
  readonly pendiente: boolean
  readonly resultado: UsuarioEncontrado | null | undefined
  readonly mensaje: string | null
  actualizar(): Promise<void>
  buscar(nombreUsuario: string): Promise<void>
  enviarSolicitud(usuarioId: string): Promise<void>
  aceptarSolicitud(usuarioId: string): Promise<void>
  eliminar(usuarioId: string): Promise<void>
}

type Accion = () => Promise<{ readonly ok: true } | ErrorDeAmigos>

export function useAmigos(alSesionVencida: () => void): UseAmigos {
  const { amigos, recibidas, enviadas, refrescar } = useEstadoDeAmigos()
  const [pendiente, setPendiente] = useState(false)
  const [resultado, setResultado] = useState<UsuarioEncontrado | null | undefined>(undefined)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  // La vista solo cambia con la respuesta del backend: se ejecuta la accion y se vuelven a pedir las listas.
  const ejecutar = useCallback(
    async (accion: Accion, alExito?: () => void) => {
      setPendiente(true)
      setMensaje(null)
      try {
        const respuesta = await accion()
        if (!respuesta.ok) {
          if (respuesta.error === 'sesion-vencida') {
            sesionVencida.current()
            return
          }
          setMensaje(mensajeDeErrorDeAmigos(respuesta))
          if (respuesta.error === 'ya-existe' || respuesta.error === 'no-encontrado') {
            await refrescar()
          }
          return
        }
        alExito?.()
        await refrescar()
      } finally {
        setPendiente(false)
      }
    },
    [refrescar]
  )

  const buscar = useCallback(
    async (nombreUsuario: string) => {
      const nombre = nombreUsuario.trim()
      if (!PATRON_DE_NOMBRE_DE_USUARIO.test(nombre)) {
        setResultado(undefined)
        setMensaje(MENSAJE_NOMBRE_DE_USUARIO_INVALIDO)
        return
      }
      await ejecutar(async () => {
        const respuesta = await window.aniimo.amigos.buscar({ nombreUsuario: nombre })
        if (respuesta.ok) {
          setResultado(respuesta.usuario)
        }
        return respuesta
      })
    },
    [ejecutar]
  )

  const enviarSolicitud = useCallback(
    (usuarioId: string) =>
      ejecutar(async () => {
        const respuesta = await window.aniimo.amigos.enviarSolicitud({ usuarioId })
        if (respuesta.ok) {
          setResultado(respuesta.usuario)
        }
        return respuesta
      }),
    [ejecutar]
  )

  const aceptarSolicitud = useCallback(
    (usuarioId: string) =>
      ejecutar(async () => {
        const respuesta = await window.aniimo.amigos.aceptarSolicitud({ usuarioId })
        if (respuesta.ok) {
          setResultado((actual) =>
            actual !== undefined && actual !== null && actual.id === usuarioId
              ? respuesta.usuario
              : actual
          )
        }
        return respuesta
      }),
    [ejecutar]
  )

  const eliminar = useCallback(
    (usuarioId: string) =>
      ejecutar(
        () => window.aniimo.amigos.eliminar({ usuarioId }),
        () =>
          setResultado((actual) =>
            actual !== undefined && actual !== null && actual.id === usuarioId
              ? { ...actual, relacion: 'ninguna' }
              : actual
          )
      ),
    [ejecutar]
  )

  const actualizar = useCallback(() => ejecutar(async () => ({ ok: true as const })), [ejecutar])

  return {
    amigos,
    recibidas,
    enviadas,
    pendiente,
    resultado,
    mensaje,
    actualizar,
    buscar,
    enviarSolicitud,
    aceptarSolicitud,
    eliminar
  }
}
