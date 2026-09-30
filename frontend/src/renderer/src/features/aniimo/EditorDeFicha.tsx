import { useEffect, useState, type ClipboardEvent, type FormEvent, type ReactElement } from 'react'
import type { ErrorDeTeams, Ficha } from '../../../../shared/teams'
import Confirmacion from '../../shared/components/Confirmacion'
import { mensajeDeErrorDeTeams } from '../teams/mensajes'
import {
  BloqueDeEntrenamiento,
  BloqueDeNotas,
  BloqueDeObjetos,
  BloqueDeStats,
  DatosGenerales
} from './bloques'
import { formularioDeFicha, formularioVacio, type FormularioDeFicha } from './formulario'
import ImagenDelAniimo from './ImagenDelAniimo'
import {
  aDataUrl,
  esTipoDeImagenPermitido,
  type ImagenRecodificada,
  type Recodificador
} from './recodificarImagen'
import {
  convertirFormulario,
  traducirCamposDelBackend,
  type ErroresDeFicha,
  type FilasUsadas
} from './validacionFicha'
import './ficha.css'

const MENSAJE_IMAGEN_NO_PERMITIDA = 'Imagen no permitida: solo PNG, JPEG o WebP'
const MENSAJE_IMAGEN_NO_PROCESADA = 'No se pudo procesar la imagen'
const MENSAJE_REVISAR_DATOS = 'Revisá los datos ingresados'

interface EstadoDeImagen {
  readonly guardada: string | null
  readonly pendiente: ImagenRecodificada | null
  readonly quitar: boolean
}

interface EditorDeFichaProps {
  readonly teamId: string
  readonly slot: number
  readonly inicial: Ficha | null
  readonly recodificar: Recodificador
  readonly alVolver: () => void
  readonly alSesionVencida: () => void
}

export default function EditorDeFicha({
  teamId,
  slot,
  inicial,
  recodificar,
  alVolver,
  alSesionVencida
}: EditorDeFichaProps): ReactElement {
  const [formulario, setFormulario] = useState<FormularioDeFicha>(() =>
    inicial === null ? formularioVacio() : formularioDeFicha(inicial)
  )
  const [errores, setErrores] = useState<ErroresDeFicha>({})
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [mensajeDeImagen, setMensajeDeImagen] = useState<string | null>(null)
  const [imagen, setImagen] = useState<EstadoDeImagen>({
    guardada: null,
    pendiente: null,
    quitar: false
  })
  const [existe, setExiste] = useState(inicial !== null)
  const [pendiente, setPendiente] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const tieneImagenGuardada = inicial?.tieneImagen ?? false

  useEffect(() => {
    if (!tieneImagenGuardada) {
      return
    }
    let activo = true
    void window.aniimo.teams.obtenerImagen({ teamId, slot }).then((resultado) => {
      if (!activo) {
        return
      }
      if (resultado.ok) {
        setImagen((actual) => ({ ...actual, guardada: resultado.imagen }))
      } else if (resultado.error === 'sesion-vencida') {
        alSesionVencida()
      }
    })
    return () => {
      activo = false
    }
  }, [teamId, slot, tieneImagenGuardada, alSesionVencida])

  const vistaPrevia = imagen.pendiente !== null
    ? aDataUrl(imagen.pendiente)
    : imagen.quitar
      ? null
      : imagen.guardada

  async function procesarArchivo(archivo: File): Promise<void> {
    setMensajeDeImagen(null)
    if (!esTipoDeImagenPermitido(archivo.type)) {
      setMensajeDeImagen(MENSAJE_IMAGEN_NO_PERMITIDA)
      return
    }
    try {
      const recodificada = await recodificar(archivo)
      setImagen((actual) => ({ ...actual, pendiente: recodificada, quitar: false }))
    } catch {
      setMensajeDeImagen(MENSAJE_IMAGEN_NO_PROCESADA)
    }
  }

  function alPegar(evento: ClipboardEvent<HTMLFormElement>): void {
    const archivos = Array.from(evento.clipboardData.files)
    const primero = archivos[0]
    if (primero === undefined) {
      return
    }
    evento.preventDefault()
    void procesarArchivo(primero)
  }

  function quitarImagen(): void {
    setMensajeDeImagen(null)
    setImagen((actual) => ({ ...actual, pendiente: null, quitar: actual.guardada !== null }))
  }

  function manejarErrorDeFicha(error: ErrorDeTeams, filas: FilasUsadas): void {
    if (error.error === 'sesion-vencida') {
      alSesionVencida()
      return
    }
    if (error.error === 'datos-invalidos') {
      const traducidos = traducirCamposDelBackend(error.campos ?? [], filas)
      setErrores(traducidos.errores)
      setMensaje(traducidos.sinCampo ? MENSAJE_REVISAR_DATOS : null)
      return
    }
    setMensaje(mensajeDeErrorDeTeams(error))
  }

  async function guardarImagen(): Promise<boolean> {
    const resultado =
      imagen.pendiente !== null
        ? await window.aniimo.teams.guardarImagen({
            teamId,
            slot,
            tipo: imagen.pendiente.tipo,
            datos: imagen.pendiente.datos
          })
        : imagen.quitar
          ? await window.aniimo.teams.borrarImagen({ teamId, slot })
          : { ok: true as const }
    if (resultado.ok) {
      return true
    }
    if (resultado.error === 'sesion-vencida') {
      alSesionVencida()
    } else {
      setMensajeDeImagen(mensajeDeErrorDeTeams(resultado))
    }
    return false
  }

  async function guardar(evento: FormEvent): Promise<void> {
    evento.preventDefault()
    const conversion = convertirFormulario(formulario)
    setMensaje(null)
    setMensajeDeImagen(null)
    if (!conversion.ok) {
      setErrores(conversion.errores)
      return
    }
    setErrores({})
    setPendiente(true)
    try {
      const resultado = await window.aniimo.teams.guardarFicha({
        teamId,
        slot,
        ficha: conversion.ficha
      })
      if (!resultado.ok) {
        manejarErrorDeFicha(resultado, conversion.filas)
        return
      }
      setExiste(true)
      if (await guardarImagen()) {
        alVolver()
      }
    } finally {
      setPendiente(false)
    }
  }

  async function borrar(): Promise<void> {
    setPendiente(true)
    try {
      const resultado = await window.aniimo.teams.vaciarSlot({ teamId, slot })
      if (resultado.ok) {
        alVolver()
        return
      }
      setConfirmando(false)
      if (resultado.error === 'sesion-vencida') {
        alSesionVencida()
      } else {
        setMensaje(mensajeDeErrorDeTeams(resultado))
      }
    } finally {
      setPendiente(false)
    }
  }

  const propiedades = { formulario, errores, deshabilitado: pendiente, alCambiar: setFormulario }

  return (
    <form className="ficha" onSubmit={(e) => void guardar(e)} onPaste={alPegar} noValidate>
      <h2 className="ficha__titulo">Ficha del Aniimo (slot {slot})</h2>
      <DatosGenerales
        {...propiedades}
        imagen={
          <ImagenDelAniimo
            src={vistaPrevia}
            mensaje={mensajeDeImagen}
            deshabilitado={pendiente}
            alElegir={(archivo) => void procesarArchivo(archivo)}
            alQuitar={quitarImagen}
          />
        }
      />
      <BloqueDeStats {...propiedades} />
      <BloqueDeEntrenamiento {...propiedades} />
      <BloqueDeObjetos {...propiedades} />
      <BloqueDeNotas {...propiedades} />
      {mensaje !== null && (
        <p className="campo__error" role="alert">
          {mensaje}
        </p>
      )}
      {confirmando && (
        <Confirmacion
          mensaje={`¿Borrar a ${formulario.nombre.trim() === '' ? 'este Aniimo' : formulario.nombre}?`}
          deshabilitado={pendiente}
          alConfirmar={() => void borrar()}
          alCancelar={() => setConfirmando(false)}
        />
      )}
      <div className="ficha__acciones">
        <button className="ficha__guardar" type="submit" disabled={pendiente}>
          Guardar
        </button>
        <button type="button" disabled={pendiente} onClick={alVolver}>
          Cancelar
        </button>
        {existe && (
          <button type="button" disabled={pendiente} onClick={() => setConfirmando(true)}>
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}
