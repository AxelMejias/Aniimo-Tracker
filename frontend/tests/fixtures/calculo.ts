import type {
  CatalogoResumen,
  PedidoCalcular,
  Sugerencia,
  SugerenciaDeValor
} from '../../src/shared/calculo'
import { STATS } from '../../src/shared/catalogos'

type Registro = Record<string, unknown>

export function pedidoDeReferencia(): PedidoCalcular {
  return {
    especieId: 'ejemplo-a',
    nivel: 30,
    potenciales: { ps: 0, atq: 10, def_fisica: 0, def_magica: 0, regen: 0, quiebre: 0 },
    estrellaActual: 1,
    personalidad: 'ENFJ',
    objetos: [{ posicion: 'equipado', objetoId: 'ejemplo-objeto-x', nivel: 1 }]
  }
}

export function pedidoDeApiDeReferencia(): Registro {
  return {
    especie_id: 'ejemplo-a',
    nivel: 30,
    potenciales: { ps: 0, atq: 10, def_fisica: 0, def_magica: 0, regen: 0, quiebre: 0 },
    estrella_actual: 1,
    personalidad: 'ENFJ',
    objetos: [{ posicion: 'equipado', objeto_id: 'ejemplo-objeto-x', nivel: 1 }]
  }
}

export function catalogoDeApiDeReferencia(): Registro {
  return {
    version: 'ejemplo-1',
    es_ejemplo: true,
    especies: [
      { id: 'ejemplo-a', nombre: 'EJEMPLO Aniimo A' },
      { id: 'ejemplo-b', nombre: 'EJEMPLO Aniimo B' }
    ],
    objetos: [{ id: 'ejemplo-objeto-x', nombre: 'EJEMPLO Objeto X' }],
    sin_datos: []
  }
}

export function catalogoDeReferencia(): CatalogoResumen {
  return {
    version: 'ejemplo-1',
    esEjemplo: true,
    especies: [
      { id: 'ejemplo-a', nombre: 'EJEMPLO Aniimo A' },
      { id: 'ejemplo-b', nombre: 'EJEMPLO Aniimo B' }
    ],
    objetos: [{ id: 'ejemplo-objeto-x', nombre: 'EJEMPLO Objeto X' }],
    sinDatos: []
  }
}

function valorApi(valor: number | null, conObjetos: number | null, extra: Registro = {}): Registro {
  return {
    valor,
    valor_con_objetos: conObjetos,
    aproximado: false,
    motivo: null,
    desglose: [{ origen: 'base', detalle: 'nivel 30', tipo: 'base', valor: 390 }],
    ...extra
  }
}

export function sugerenciaDeApiDeReferencia(): Registro {
  const stats: Registro = {}
  for (const { codigo } of STATS) {
    stats[codigo] = valorApi(1000, 1000)
  }
  stats.atq = valorApi(458, 509, { aproximado: true })
  return {
    version: 'ejemplo-1',
    es_ejemplo: true,
    stats,
    cp: valorApi(578, 629, { aproximado: true }),
    objetos: [{ posicion: 'equipado', aplicado: true, nota: null }],
    sin_datos: []
  }
}

function valorDeReferencia(
  valor: number | null,
  conObjetos: number | null,
  cambios: Partial<SugerenciaDeValor> = {}
): SugerenciaDeValor {
  return {
    valor,
    valorConObjetos: conObjetos,
    aproximado: false,
    motivo: null,
    desglose: [{ origen: 'base', detalle: 'nivel 30', tipo: 'base', valor: 390 }],
    ...cambios
  }
}

export function sugerenciaDeReferencia(): Sugerencia {
  const base = valorDeReferencia(1000, 1000)
  return {
    version: 'ejemplo-1',
    esEjemplo: true,
    stats: {
      ps: base,
      atq: valorDeReferencia(458, 509, { aproximado: true }),
      def_fisica: base,
      def_magica: base,
      regen: base,
      quiebre: base
    },
    cp: valorDeReferencia(578, 629, { aproximado: true }),
    objetos: [{ posicion: 'equipado', aplicado: true, nota: null }],
    sinDatos: []
  }
}
