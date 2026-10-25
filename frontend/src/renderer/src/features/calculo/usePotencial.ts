import { useEffect, useRef, useState } from 'react'
import type { PedidoPotencial, Potencial } from '../../../../shared/calculo'
import type { FormularioDeFicha } from '../aniimo/formulario'
import { mensajeDeErrorDeCalculo } from './mensajes'
import { entradaDePotencial, estaDesactualizado, type ResultadoDeEntradaDePotencial } from './potencial'
import { porNombre } from './sugerencia'
import type { CatalogoCompartido } from './useCatalogo'

export interface PotencialHecho {
  readonly pedido: PedidoPotencial
  readonly potencial: Potencial
}

export interface EstadoDePotencial {
  readonly abierta: boolean
  readonly alternarApertura: () => void
  readonly tieneObjetoEquipado: boolean
  readonly objetoElegido: string
  readonly elegirObjeto: (id: string) => void
  readonly entrada: ResultadoDeEntradaDePotencial
  readonly calculo: PotencialHecho | null
  readonly desactualizado: boolean
  readonly pendiente: boolean
  readonly mensaje: string | null
  readonly calcular: () => Promise<void>
}

export function usePotencial(
  formulario: FormularioDeFicha,
  alSesionVencida: () => void,
  catalogo: CatalogoCompartido
): EstadoDePotencial {
  const [abierta, setAbierta] = useState(false)
  const [elegido, setElegido] = useState<string | undefined>(undefined)
  const [calculo, setCalculo] = useState<PotencialHecho | null>(null)
  const [pendiente, setPendiente] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const montado = useRef(true)
  const sesionVencida = useRef(alSesionVencida)
  sesionVencida.current = alSesionVencida
  const { solicitar } = catalogo

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  useEffect(() => {
    if (abierta) {
      solicitar()
    }
  }, [abierta, solicitar])

  const objetos = catalogo.estado.tipo === 'listo' ? catalogo.estado.catalogo.objetos : []
  const equipado = formulario.objetos[0]
  const tieneObjetoEquipado = equipado !== undefined && equipado.nombre.trim() !== ''
  const objetoElegido =
    elegido ?? (tieneObjetoEquipado ? (porNombre(equipado.nombre, objetos) ?? '') : '')
  const entrada = entradaDePotencial(formulario, objetoElegido === '' ? null : objetoElegido)
  const desactualizado =
    calculo !== null && estaDesactualizado(entrada.ok ? entrada.pedido : null, calculo.pedido)

  async function calcular(): Promise<void> {
    if (!entrada.ok) {
      return
    }
    setPendiente(true)
    setMensaje(null)
    const resultado = await window.aniimo.calculo.potencial(entrada.pedido)
    if (!montado.current) {
      return
    }
    setPendiente(false)
    if (resultado.ok) {
      setCalculo({ pedido: entrada.pedido, potencial: resultado.potencial })
    } else if (resultado.error === 'sesion-vencida') {
      sesionVencida.current()
    } else {
      setMensaje(mensajeDeErrorDeCalculo(resultado.error))
    }
  }

  return {
    abierta,
    alternarApertura: () => setAbierta((actual) => !actual),
    tieneObjetoEquipado,
    objetoElegido,
    elegirObjeto: setElegido,
    entrada,
    calculo,
    desactualizado,
    pendiente,
    mensaje,
    calcular
  }
}
