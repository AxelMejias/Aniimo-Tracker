import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  compararFichas,
  compararTeams,
  type FilaDeComparacion,
  type ParDeSlots
} from '../features/comparacion/comparar'
import SelectorDeLado, {
  DUENIO_PROPIO,
  SELECCION_VACIA,
  type OpcionDeDuenio,
  type SeleccionDeLado
} from '../features/comparacion/SelectorDeLado'
import { TablaDeComparacion, TablaDeTeams } from '../features/comparacion/TablaDeComparacion'
import { useEstadoDeAmigos } from '../features/friends/EstadoDeAmigos'
import { MENSAJE_SIN_ACCESO } from '../features/friends/mensajes'
import { MENSAJE_ERROR_INESPERADO, MENSAJE_SIN_CONEXION } from '../shared/mensajes'
import '../features/comparacion/comparacion.css'

export interface LadoInicial {
  readonly usuarioId: string
  readonly nombreUsuario: string
  readonly teamId: string
  readonly slot: number
}

interface ComparacionPageProps {
  readonly derecho?: LadoInicial
  readonly alSesionVencida: () => void
}

const MENSAJE_INCOMPLETA = 'Elegí un slot en los dos lados para comparar fichas, o en ninguno para comparar teams.'
const MENSAJE_SLOT_VACIO = 'El slot elegido no tiene un Aniimo'

type Lectura<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly error: string }

type FichaComparable = Parameters<typeof compararFichas>[0]
type TeamComparable = Parameters<typeof compararTeams>[0] & { readonly nombre: string }

type Resultado =
  | { readonly tipo: 'inactivo' }
  | { readonly tipo: 'cargando' }
  | { readonly tipo: 'mensaje'; readonly texto: string }
  | {
      readonly tipo: 'fichas'
      readonly izquierda: string
      readonly derecha: string
      readonly filas: readonly FilaDeComparacion[]
    }
  | {
      readonly tipo: 'teams'
      readonly izquierda: string
      readonly derecha: string
      readonly pares: readonly ParDeSlots[]
    }

type Veredicto =
  | { readonly tipo: 'listo'; readonly resultado: Resultado }
  | { readonly tipo: 'fallo'; readonly izquierda: string | null; readonly derecha: string | null }

interface Etiquetas {
  readonly izquierda: string
  readonly derecha: string
}

async function leerFicha(seleccion: SeleccionDeLado): Promise<Lectura<FichaComparable | null>> {
  const slot = Number(seleccion.slot)
  const resultado =
    seleccion.duenio === DUENIO_PROPIO
      ? await window.aniimo.teams.obtenerFicha({ teamId: seleccion.teamId, slot })
      : await window.aniimo.amigos.obtenerFicha({
          usuarioId: seleccion.duenio,
          teamId: seleccion.teamId,
          slot
        })
  return resultado.ok ? { ok: true, valor: resultado.ficha } : { ok: false, error: resultado.error }
}

async function leerTeam(seleccion: SeleccionDeLado): Promise<Lectura<TeamComparable>> {
  const resultado =
    seleccion.duenio === DUENIO_PROPIO
      ? await window.aniimo.teams.listar()
      : await window.aniimo.amigos.listarTeams({ usuarioId: seleccion.duenio })
  if (!resultado.ok) {
    return { ok: false, error: resultado.error }
  }
  const team = resultado.teams.find((candidato) => candidato.id === seleccion.teamId)
  return team === undefined ? { ok: false, error: 'no-encontrado' } : { ok: true, valor: team }
}

async function resolverFichas(
  izquierda: SeleccionDeLado,
  derecha: SeleccionDeLado,
  etiquetas: Etiquetas
): Promise<Veredicto> {
  const [a, b] = await Promise.all([leerFicha(izquierda), leerFicha(derecha)])
  if (!a.ok || !b.ok) {
    return {
      tipo: 'fallo',
      izquierda: a.ok ? null : a.error,
      derecha: b.ok ? null : b.error
    }
  }
  if (a.valor === null || b.valor === null) {
    return { tipo: 'listo', resultado: { tipo: 'mensaje', texto: MENSAJE_SLOT_VACIO } }
  }
  return {
    tipo: 'listo',
    resultado: {
      tipo: 'fichas',
      izquierda: `${etiquetas.izquierda}: ${a.valor.nombre}`,
      derecha: `${etiquetas.derecha}: ${b.valor.nombre}`,
      filas: compararFichas(a.valor, b.valor)
    }
  }
}

async function resolverTeams(
  izquierda: SeleccionDeLado,
  derecha: SeleccionDeLado,
  etiquetas: Etiquetas
): Promise<Veredicto> {
  const [a, b] = await Promise.all([leerTeam(izquierda), leerTeam(derecha)])
  if (!a.ok || !b.ok) {
    return {
      tipo: 'fallo',
      izquierda: a.ok ? null : a.error,
      derecha: b.ok ? null : b.error
    }
  }
  return {
    tipo: 'listo',
    resultado: {
      tipo: 'teams',
      izquierda: `${etiquetas.izquierda}: ${a.valor.nombre}`,
      derecha: `${etiquetas.derecha}: ${b.valor.nombre}`,
      pares: compararTeams(a.valor, b.valor)
    }
  }
}

function estaCompleta(izquierda: SeleccionDeLado, derecha: SeleccionDeLado): boolean {
  return (
    izquierda.duenio !== '' &&
    izquierda.teamId !== '' &&
    derecha.duenio !== '' &&
    derecha.teamId !== '' &&
    (izquierda.slot === '') === (derecha.slot === '')
  )
}

export default function ComparacionPage({
  derecho,
  alSesionVencida
}: ComparacionPageProps): ReactElement {
  const { amigos, refrescar } = useEstadoDeAmigos()
  const [izquierda, setIzquierda] = useState<SeleccionDeLado>(SELECCION_VACIA)
  const [derecha, setDerecha] = useState<SeleccionDeLado>(
    derecho === undefined
      ? SELECCION_VACIA
      : { duenio: derecho.usuarioId, teamId: derecho.teamId, slot: String(derecho.slot) }
  )
  const [aviso, setAviso] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado>({ tipo: 'inactivo' })
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  const duenios = useMemo<OpcionDeDuenio[]>(() => {
    const lista: OpcionDeDuenio[] = [
      { codigo: DUENIO_PROPIO, etiqueta: 'Yo' },
      ...amigos.map((amigo) => ({ codigo: amigo.id, etiqueta: amigo.nombreUsuario }))
    ]
    if (derecho !== undefined && !lista.some((opcion) => opcion.codigo === derecho.usuarioId)) {
      lista.push({ codigo: derecho.usuarioId, etiqueta: derecho.nombreUsuario })
    }
    return lista
  }, [amigos, derecho])

  const etiquetas = useRef<Etiquetas>({ izquierda: '', derecha: '' })
  const etiquetaDe = (duenio: string): string =>
    duenios.find((opcion) => opcion.codigo === duenio)?.etiqueta ?? duenio
  etiquetas.current = { izquierda: etiquetaDe(izquierda.duenio), derecha: etiquetaDe(derecha.duenio) }

  useEffect(() => {
    if (!estaCompleta(izquierda, derecha)) {
      setResultado({ tipo: 'inactivo' })
      return
    }
    let activo = true
    setResultado({ tipo: 'cargando' })
    setAviso(null)
    void refrescar()
    const resolver = izquierda.slot !== '' ? resolverFichas : resolverTeams
    void resolver(izquierda, derecha, etiquetas.current).then((veredicto) => {
      if (!activo) {
        return
      }
      if (veredicto.tipo === 'listo') {
        setResultado(veredicto.resultado)
        return
      }
      const errores = [veredicto.izquierda, veredicto.derecha]
      if (errores.includes('sesion-vencida')) {
        sesionVencida.current()
        return
      }
      if (veredicto.izquierda === 'no-encontrado') {
        setIzquierda(SELECCION_VACIA)
      }
      if (veredicto.derecha === 'no-encontrado') {
        setDerecha(SELECCION_VACIA)
      }
      if (errores.includes('no-encontrado')) {
        setAviso(MENSAJE_SIN_ACCESO)
        setResultado({ tipo: 'inactivo' })
        return
      }
      const otro = errores.find((error) => error !== null)
      setResultado({
        tipo: 'mensaje',
        texto: otro === 'sin-conexion' ? MENSAJE_SIN_CONEXION : MENSAJE_ERROR_INESPERADO
      })
    })
    return () => {
      activo = false
    }
  }, [izquierda, derecha, refrescar])

  function sinAcceso(lado: 'izquierda' | 'derecha'): void {
    if (lado === 'izquierda') {
      setIzquierda(SELECCION_VACIA)
    } else {
      setDerecha(SELECCION_VACIA)
    }
    setAviso(MENSAJE_SIN_ACCESO)
  }

  return (
    <section className="principal__seccion comparacion">
      <h2 className="principal__subtitulo" tabIndex={-1}>Comparar</h2>
      <div className="comparacion__lados">
        <SelectorDeLado
          titulo="Lado izquierdo"
          seleccion={izquierda}
          duenios={duenios}
          alCambiar={setIzquierda}
          alSinAcceso={() => sinAcceso('izquierda')}
          alSesionVencida={alSesionVencida}
        />
        <SelectorDeLado
          titulo="Lado derecho"
          seleccion={derecha}
          duenios={duenios}
          alCambiar={setDerecha}
          alSinAcceso={() => sinAcceso('derecha')}
          alSesionVencida={alSesionVencida}
        />
      </div>
      {aviso !== null && (
        <p className="comparacion__aviso" role="alert">
          {aviso}
        </p>
      )}
      {resultado.tipo === 'inactivo' && <p className="comparacion__ayuda">{MENSAJE_INCOMPLETA}</p>}
      {resultado.tipo === 'cargando' && <p className="comparacion__ayuda">Cargando comparación…</p>}
      {resultado.tipo === 'mensaje' && (
        <p className="comparacion__aviso" role="alert">
          {resultado.texto}
        </p>
      )}
      {resultado.tipo === 'fichas' && (
        <TablaDeComparacion
          izquierda={resultado.izquierda}
          derecha={resultado.derecha}
          filas={resultado.filas}
        />
      )}
      {resultado.tipo === 'teams' && (
        <TablaDeTeams
          izquierda={resultado.izquierda}
          derecha={resultado.derecha}
          pares={resultado.pares}
        />
      )}
    </section>
  )
}
