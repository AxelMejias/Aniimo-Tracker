import { useEffect, useRef, useState } from 'react'
import type { PedidoCalcular, Sugerencia } from '../../../../shared/calculo'
import type { CodigoDePosicionDeObjeto } from '../../../../shared/catalogos'
import {
  POSICIONES_DE_OBJETO_EN_ORDEN,
  type FormularioDeFicha
} from '../aniimo/formulario'
import { MENSAJE_SIN_ESPECIE, mensajeDeErrorDeCalculo } from './mensajes'
import {
  entradaDesdeFormulario,
  estaDesactualizada,
  porNombre,
  type ObjetosElegidos,
  type ResultadoDeEntrada
} from './sugerencia'
import type { CatalogoCompartido, EstadoDelCatalogo } from './useCatalogo'

export interface CalculoHecho {
  readonly pedido: PedidoCalcular
  readonly sugerencia: Sugerencia
}

export interface ObjetoCargado {
  readonly posicion: CodigoDePosicionDeObjeto
  readonly elegido: string
}

export interface EstadoDeCalculo {
  readonly abierta: boolean
  readonly alternarApertura: () => void
  readonly catalogo: EstadoDelCatalogo
  readonly especieId: string
  readonly elegirEspecie: (id: string) => void
  readonly objetosCargados: readonly ObjetoCargado[]
  readonly elegirObjeto: (posicion: CodigoDePosicionDeObjeto, id: string) => void
  readonly incluirObjetos: boolean
  readonly cambiarIncluirObjetos: (incluir: boolean) => void
  readonly entrada: ResultadoDeEntrada
  readonly calculo: CalculoHecho | null
  readonly desactualizada: boolean
  readonly pendiente: boolean
  readonly mensaje: string | null
  readonly calcular: () => Promise<void>
}

export function useCalculo(
  formulario: FormularioDeFicha,
  alSesionVencida: () => void,
  compartido: CatalogoCompartido
): EstadoDeCalculo {
  const [abierta, setAbierta] = useState(false)
  const [especieElegida, setEspecieElegida] = useState<string | undefined>(undefined)
  const [objetosElegidos, setObjetosElegidos] = useState<
    Partial<Record<CodigoDePosicionDeObjeto, string>>
  >({})
  const [incluirObjetos, setIncluirObjetos] = useState(true)
  const [calculo, setCalculo] = useState<CalculoHecho | null>(null)
  const [pendiente, setPendiente] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const montado = useRef(true)
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const { solicitar } = compartido
  useEffect(() => {
    if (abierta) {
      solicitar()
    }
  }, [abierta, solicitar])

  const catalogo = compartido.estado
  const especies = catalogo.tipo === 'listo' ? catalogo.catalogo.especies : []
  const objetosDelCatalogo = catalogo.tipo === 'listo' ? catalogo.catalogo.objetos : []
  const especieId = especieElegida ?? porNombre(formulario.nombre, especies) ?? ''

  const objetosCargados = POSICIONES_DE_OBJETO_EN_ORDEN.flatMap((posicion, indice) => {
    const objeto = formulario.objetos[indice]
    if (objeto === undefined || objeto.nombre.trim() === '') {
      return []
    }
    const elegido = objetosElegidos[posicion] ?? porNombre(objeto.nombre, objetosDelCatalogo) ?? ''
    return [{ posicion, elegido }]
  })
  const elegidos: ObjetosElegidos = {
    equipado: objetosCargados.find((o) => o.posicion === 'equipado')?.elegido || null,
    alternativo: objetosCargados.find((o) => o.posicion === 'alternativo')?.elegido || null
  }

  const entrada: ResultadoDeEntrada =
    especieId === ''
      ? { ok: false, motivo: MENSAJE_SIN_ESPECIE }
      : entradaDesdeFormulario(formulario, especieId, elegidos)
  const desactualizada =
    calculo !== null && estaDesactualizada(entrada.ok ? entrada.pedido : null, calculo.pedido)

  async function calcular(): Promise<void> {
    if (!entrada.ok) {
      return
    }
    setPendiente(true)
    setMensaje(null)
    const resultado = await window.aniimo.calculo.calcular(entrada.pedido)
    if (!montado.current) {
      return
    }
    setPendiente(false)
    if (resultado.ok) {
      setCalculo({ pedido: entrada.pedido, sugerencia: resultado.sugerencia })
    } else if (resultado.error === 'sesion-vencida') {
      sesionVencida.current()
    } else {
      setMensaje(mensajeDeErrorDeCalculo(resultado.error))
    }
  }

  return {
    abierta,
    alternarApertura: () => setAbierta((actual) => !actual),
    catalogo,
    especieId,
    elegirEspecie: setEspecieElegida,
    objetosCargados,
    elegirObjeto: (posicion, id) => setObjetosElegidos((actual) => ({ ...actual, [posicion]: id })),
    incluirObjetos,
    cambiarIncluirObjetos: setIncluirObjetos,
    entrada,
    calculo,
    desactualizada,
    pendiente,
    mensaje,
    calcular
  }
}
