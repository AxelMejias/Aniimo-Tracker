import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type ReactElement
} from 'react'
import type { ErrorDeTeams, Ficha } from '../../../../shared/teams'
import Confirmacion from '../../shared/components/Confirmacion'
import { STATS } from '../../../../shared/catalogos'
import { useCatalogoCompartido } from '../calculo/useCatalogo'
import { mensajeDeErrorDeTeams } from '../teams/mensajes'
import {
  BloqueDeEntrenamiento,
  BloqueDeNotas,
  BloqueDeObjetos,
  BloqueDePotencial,
  BloqueDeStats,
  DatosGenerales
} from './bloques'
import CartaDeFicha from './CartaDeFicha'
import { formularioDeFicha, formularioVacio, type FormularioDeFicha } from './formulario'
import ImagenDelAniimo from './ImagenDelAniimo'
import PestanasDeFicha from './PestanasDeFicha'
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
import { MigasDeFicha, useUbicacionDeFicha, type NavegacionDeFicha } from './UbicacionDeFicha'
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
  readonly alVolver: (guardada: boolean) => void
  readonly alSesionVencida: () => void
  readonly alCambiarSinGuardar?: (hayCambios: boolean) => void
  readonly migas?: NavegacionDeFicha
}

const PESTANAS = [
  { id: 'generales', etiqueta: 'Generales' },
  { id: 'stats', etiqueta: 'Stats' },
  { id: 'entrenamiento', etiqueta: 'Entrenamiento' },
  { id: 'objetos', etiqueta: 'Objetos' },
  { id: 'notas', etiqueta: 'Notas' },
  { id: 'potencial', etiqueta: 'Potencial' }
] as const

function potencialComoNumero(texto: string): number | null {
  return /^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null
}

export default function EditorDeFicha({
  teamId,
  slot,
  inicial,
  recodificar,
  alVolver,
  alSesionVencida,
  alCambiarSinGuardar,
  migas
}: EditorDeFichaProps): ReactElement {
  const [formularioInicial] = useState<FormularioDeFicha>(() =>
    inicial === null ? formularioVacio() : formularioDeFicha(inicial)
  )
  const [formulario, setFormulario] = useState<FormularioDeFicha>(formularioInicial)
  const formRef = useRef<HTMLFormElement>(null)
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
  const [descartando, setDescartando] = useState(false)
  const [activa, setActiva] = useState<string>(PESTANAS[0].id)
  const [enfocarError, setEnfocarError] = useState(false)
  const ubicacion = useUbicacionDeFicha(teamId, slot)

  const catalogo = useCatalogoCompartido(alSesionVencida)
  const tieneImagenGuardada = inicial?.tieneImagen ?? false

  const hayCambios =
    JSON.stringify(formulario) !== JSON.stringify(formularioInicial) ||
    imagen.pendiente !== null ||
    imagen.quitar

  useEffect(() => {
    alCambiarSinGuardar?.(hayCambios)
  }, [hayCambios, alCambiarSinGuardar])

  useEffect(() => {
    if (Object.keys(errores).length === 0) {
      return
    }
    const invalido = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
    const pestana = invalido?.closest<HTMLElement>('[data-pestana]')?.dataset['pestana']
    if (pestana !== undefined) {
      setActiva(pestana)
    }
    setEnfocarError(true)
  }, [errores])

  useEffect(() => {
    if (enfocarError) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      setEnfocarError(false)
    }
  }, [enfocarError, activa])

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
        alVolver(true)
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
        alVolver(false)
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
  const contenidos: Readonly<Record<(typeof PESTANAS)[number]['id'], ReactElement>> = {
    generales: <DatosGenerales {...propiedades} />,
    stats: (
      <BloqueDeStats {...propiedades} catalogo={catalogo} alSesionVencida={alSesionVencida} />
    ),
    entrenamiento: <BloqueDeEntrenamiento {...propiedades} />,
    objetos: <BloqueDeObjetos {...propiedades} />,
    notas: <BloqueDeNotas {...propiedades} />,
    potencial: (
      <BloqueDePotencial {...propiedades} catalogo={catalogo} alSesionVencida={alSesionVencida} />
    )
  }

  return (
    <form ref={formRef} className="ficha" onSubmit={(e) => void guardar(e)} onPaste={alPegar} noValidate>
      {migas !== undefined && (
        <MigasDeFicha slot={slot} ubicacion={ubicacion} navegacion={migas} />
      )}
      <h2 className="ficha__titulo" tabIndex={-1}>
        Ficha del Aniimo (slot {slot})
      </h2>
      <div className="ficha__cuerpo">
        <CartaDeFicha
          nombre={formulario.nombre}
          nivel={formulario.nivel}
          cp={formulario.cp}
          elemento={formulario.elemento === '' ? null : formulario.elemento}
          rol={formulario.rol === '' ? null : formulario.rol}
          personalidad={formulario.personalidad.join('')}
          esPortada={ubicacion?.esPortada ?? false}
          imagen={vistaPrevia}
          altDeImagen="Vista previa del Aniimo"
          potenciales={STATS.map(({ codigo, etiqueta }) => ({
            codigo,
            etiqueta,
            valor: potencialComoNumero(formulario.stats[codigo].potencial)
          }))}
        >
          <ImagenDelAniimo
            src={vistaPrevia}
            mensaje={mensajeDeImagen}
            deshabilitado={pendiente}
            alElegir={(archivo) => void procesarArchivo(archivo)}
            alQuitar={quitarImagen}
          />
        </CartaDeFicha>
        <PestanasDeFicha
          activa={activa}
          alCambiar={setActiva}
          paneles={PESTANAS.map(({ id, etiqueta }) => ({
            id,
            etiqueta,
            contenido: contenidos[id]
          }))}
        />
      </div>
      {mensaje !== null && (
        <p className="campo__error" role="alert">
          {mensaje}
        </p>
      )}
      {descartando && (
        <Confirmacion
          mensaje="¿Descartar los cambios de la ficha?"
          etiquetaConfirmar="Descartar cambios"
          deshabilitado={pendiente}
          alConfirmar={() => alVolver(false)}
          alCancelar={() => setDescartando(false)}
        />
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
        <button
          type="button"
          disabled={pendiente}
          onClick={() => (hayCambios ? setDescartando(true) : alVolver(false))}
        >
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
