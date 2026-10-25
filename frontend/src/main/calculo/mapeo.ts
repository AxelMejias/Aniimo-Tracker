import {
  MOTIVOS_DE_SUGERENCIA,
  NOTAS_DE_OBJETO,
  type CatalogoResumen,
  type ElementoDelCatalogo,
  type MotivoDeSugerencia,
  type NotaDeObjeto,
  type PedidoCalcular,
  type ResultadoDeObjeto,
  type Sugerencia,
  type SugerenciaDeValor,
  type TerminoDeDesglose
} from '../../shared/calculo'
import { POSICIONES_DE_OBJETO, STATS, type CodigoDeStat } from '../../shared/catalogos'
import {
  booleano,
  enteroONulo,
  lista,
  registro,
  RespuestaInvalida,
  texto
} from '../teams/mapeo'

export function pedidoAApi(pedido: PedidoCalcular): Record<string, unknown> {
  return {
    especie_id: pedido.especieId,
    nivel: pedido.nivel,
    potenciales: { ...pedido.potenciales },
    estrella_actual: pedido.estrellaActual,
    personalidad: pedido.personalidad,
    objetos: pedido.objetos.map((objeto) => ({
      posicion: objeto.posicion,
      objeto_id: objeto.objetoId,
      nivel: objeto.nivel
    }))
  }
}

function elementoDeApi(valor: unknown): ElementoDelCatalogo {
  const elemento = registro(valor)
  return { id: texto(elemento.id), nombre: texto(elemento.nombre) }
}

function textos(valor: unknown): string[] {
  return lista(valor).map(texto)
}

export function catalogoDeApi(valor: unknown): CatalogoResumen {
  const catalogo = registro(valor)
  return {
    version: texto(catalogo.version),
    esEjemplo: booleano(catalogo.es_ejemplo),
    especies: lista(catalogo.especies).map(elementoDeApi),
    objetos: lista(catalogo.objetos).map(elementoDeApi),
    sinDatos: textos(catalogo.sin_datos)
  }
}

function numero(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new RespuestaInvalida()
  }
  return valor
}

function motivoDeApi(valor: unknown): MotivoDeSugerencia | null {
  if (valor === null) {
    return null
  }
  const motivo = MOTIVOS_DE_SUGERENCIA.find((candidato) => candidato === valor)
  if (motivo === undefined) {
    throw new RespuestaInvalida()
  }
  return motivo
}

function notaDeApi(valor: unknown): NotaDeObjeto | null {
  if (valor === null) {
    return null
  }
  const nota = NOTAS_DE_OBJETO.find((candidata) => candidata === valor)
  if (nota === undefined) {
    throw new RespuestaInvalida()
  }
  return nota
}

function terminoDeApi(valor: unknown): TerminoDeDesglose {
  const termino = registro(valor)
  return {
    origen: texto(termino.origen),
    detalle: texto(termino.detalle),
    tipo: texto(termino.tipo),
    valor: numero(termino.valor)
  }
}

function valorSugeridoDeApi(valor: unknown): SugerenciaDeValor {
  const sugerido = registro(valor)
  return {
    valor: enteroONulo(sugerido.valor),
    valorConObjetos: enteroONulo(sugerido.valor_con_objetos),
    aproximado: booleano(sugerido.aproximado),
    motivo: motivoDeApi(sugerido.motivo),
    desglose: lista(sugerido.desglose).map(terminoDeApi)
  }
}

function objetoDeApi(valor: unknown): ResultadoDeObjeto {
  const objeto = registro(valor)
  const posicion = POSICIONES_DE_OBJETO.find((p) => p.codigo === objeto.posicion)
  if (posicion === undefined) {
    throw new RespuestaInvalida()
  }
  return {
    posicion: posicion.codigo,
    aplicado: booleano(objeto.aplicado),
    nota: notaDeApi(objeto.nota)
  }
}

export function sugerenciaDeApi(valor: unknown): Sugerencia {
  const sugerencia = registro(valor)
  const stats = registro(sugerencia.stats)
  const porStat = Object.fromEntries(
    STATS.map((stat) => [stat.codigo, valorSugeridoDeApi(stats[stat.codigo])])
  ) as Record<CodigoDeStat, SugerenciaDeValor>
  return {
    version: texto(sugerencia.version),
    esEjemplo: booleano(sugerencia.es_ejemplo),
    stats: porStat,
    cp: valorSugeridoDeApi(sugerencia.cp),
    objetos: lista(sugerencia.objetos).map(objetoDeApi),
    sinDatos: textos(sugerencia.sin_datos)
  }
}
