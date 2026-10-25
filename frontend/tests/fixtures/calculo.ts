import type {
  CatalogoResumen,
  PedidoCalcular,
  PedidoPotencial,
  Potencial,
  PotencialDeStat,
  Sugerencia,
  SugerenciaDeValor
} from '../../src/shared/calculo'
import { STATS, type CodigoDeStat } from '../../src/shared/catalogos'

type Registro = Record<string, unknown>

export function pedidoDeReferencia(): PedidoCalcular {
  return {
    especieId: 'ejemplo-a',
    nivel: 30,
    potenciales: { ps: 0, atq: 10, def_fisica: 0, def_magica: 0, regen: 0, quiebre: 0 },
    etapaEstrella: 1,
    personalidad: 'ENFJ',
    objetos: [{ posicion: 'equipado', objetoId: 'ejemplo-objeto-x', nivel: 1 }]
  }
}

export function pedidoDeApiDeReferencia(): Registro {
  return {
    especie_id: 'ejemplo-a',
    nivel: 30,
    potenciales: { ps: 0, atq: 10, def_fisica: 0, def_magica: 0, regen: 0, quiebre: 0 },
    etapa_estrella: 1,
    personalidad: 'ENFJ',
    objetos: [{ posicion: 'equipado', objeto_id: 'ejemplo-objeto-x', nivel: 1 }]
  }
}

export function catalogoDeApiDeReferencia(): Registro {
  return {
    formato: 2,
    version: 'ejemplo-2',
    es_ejemplo: true,
    estimacion_verificada: false,
    fecha_parche: '2026-09-23',
    cambios_conocidos: [
      { fecha: '2026-09-23', descripcion: 'Actualizacion del 23/09', confianza: 'fan' }
    ],
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
    formato: 2,
    version: 'ejemplo-2',
    esEjemplo: true,
    estimacionVerificada: false,
    fechaParche: '2026-09-23',
    cambiosConocidos: [
      { fecha: '2026-09-23', descripcion: 'Actualizacion del 23/09', confianza: 'fan' }
    ],
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
  stats.atq = valorApi(474, 522, { aproximado: true })
  return {
    version: 'ejemplo-2',
    es_ejemplo: true,
    estimacion_verificada: false,
    fecha_parche: '2026-09-23',
    stats,
    cp: valorApi(594, 642, { aproximado: true }),
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
    version: 'ejemplo-2',
    esEjemplo: true,
    estimacionVerificada: false,
    fechaParche: '2026-09-23',
    stats: {
      ps: base,
      atq: valorDeReferencia(474, 522, { aproximado: true }),
      def_fisica: base,
      def_magica: base,
      regen: base,
      quiebre: base
    },
    cp: valorDeReferencia(594, 642, { aproximado: true }),
    objetos: [{ posicion: 'equipado', aplicado: true, nota: null }],
    sinDatos: []
  }
}

export function pedidoDePotencialDeReferencia(): PedidoPotencial {
  return {
    nivel: 60,
    etapaEstrella: 6,
    potenciales: { ps: 11, atq: 20, def_fisica: 5, def_magica: 4, regen: 20, quiebre: 6 },
    personalidad: 'ENFJ',
    objetoEquipado: null,
    despertaresUsados: 28,
    despertaresTotal: 43,
    fechaParche: null
  }
}

export function pedidoDePotencialDeApiDeReferencia(): Registro {
  return {
    nivel: 60,
    etapa_estrella: 6,
    potenciales: { ps: 11, atq: 20, def_fisica: 5, def_magica: 4, regen: 20, quiebre: 6 },
    personalidad: 'ENFJ',
    objeto_equipado: null,
    despertares_usados: 28,
    despertares_total: 43,
    fecha_parche: null
  }
}

interface DatosDeStatDePotencial {
  readonly potencial: number
  readonly saltos: number
  readonly proximo: number
  readonly via: 'si' | 'sin-cupo' | 'tope'
}

const STATS_DE_IRISALIS: Readonly<Record<CodigoDeStat, DatosDeStatDePotencial>> = {
  ps: { potencial: 11, saltos: 3, proximo: 16, via: 'si' },
  atq: { potencial: 20, saltos: 5, proximo: 24, via: 'tope' },
  def_fisica: { potencial: 5, saltos: 1, proximo: 8, via: 'si' },
  def_magica: { potencial: 4, saltos: 1, proximo: 8, via: 'si' },
  regen: { potencial: 20, saltos: 5, proximo: 24, via: 'tope' },
  quiebre: { potencial: 6, saltos: 2, proximo: 12, via: 'si' }
}

function statDePotencialDeApi(datos: DatosDeStatDePotencial): Registro {
  const n = datos.potencial + 2
  return {
    potencial: datos.potencial,
    bono_estrella: 2,
    bono_objeto: 0,
    n,
    saltos: datos.saltos,
    proximo_salto: datos.proximo,
    puntos_al_proximo: datos.proximo - n,
    porcentaje_por_puntos: 0.8 * n,
    porcentaje_por_saltos: 4 * datos.saltos,
    via_despertar: datos.via
  }
}

function statDePotencial(datos: DatosDeStatDePotencial): PotencialDeStat {
  const n = datos.potencial + 2
  return {
    potencial: datos.potencial,
    bonoEstrella: 2,
    bonoObjeto: 0,
    n,
    saltos: datos.saltos,
    proximoSalto: datos.proximo,
    puntosAlProximo: datos.proximo - n,
    porcentajePorPuntos: 0.8 * n,
    porcentajePorSaltos: 4 * datos.saltos,
    viaDespertar: datos.via
  }
}

const CAMBIO_DE_API = {
  fecha: '2026-09-23',
  descripcion: 'Actualizacion del 23/09',
  confianza: 'fan'
}

export function potencialDeApiDeReferencia(): Registro {
  const stats: Registro = {}
  for (const { codigo } of STATS) {
    stats[codigo] = statDePotencialDeApi(STATS_DE_IRISALIS[codigo])
  }
  return {
    version: 'ejemplo-2',
    es_ejemplo: true,
    fecha_parche: '2026-09-23',
    potencial: {
      confianza: 'medido',
      por_punto: 0.8,
      salto_cada: 4,
      salto_porcentaje: 4,
      cuenta_estrella: true,
      cuenta_objeto: true,
      stats
    },
    despertar: {
      confianza: 'medido',
      cupo_sugerido: 43,
      desglose: [
        { origen: 'nivel', detalle: 'nivel 1', suma: 5 },
        { origen: 'nivel', detalle: 'nivel 45', suma: 5 },
        { origen: 'nivel', detalle: 'nivel 55', suma: 10 },
        { origen: 'nivel', detalle: 'nivel 60', suma: 10 },
        { origen: 'etapa', detalle: 'etapa 5', suma: 5 },
        { origen: 'etapa', detalle: 'etapa 6', suma: 8 }
      ],
      total_cargado: 43,
      diferencia: 0,
      restantes: 15
    },
    personalidad: [
      {
        letra: 'E',
        nombre: 'Energetic',
        letra_confirmada: true,
        confianza: 'medido',
        bonos: [
          { stat: 'atq', descripcion: 'atq', porcentaje: 2 },
          { stat: 'quiebre', descripcion: 'quiebre', porcentaje: 2 }
        ]
      },
      {
        letra: 'N',
        nombre: 'Nimble',
        letra_confirmada: true,
        confianza: 'medido',
        bonos: [{ stat: null, descripcion: 'Prob. de critico', porcentaje: 5 }]
      },
      {
        letra: 'F',
        nombre: 'Faithful',
        letra_confirmada: false,
        confianza: 'medido',
        bonos: [{ stat: 'def_magica', descripcion: 'def_magica', porcentaje: 6 }]
      },
      {
        letra: 'J',
        nombre: 'Judicious',
        letra_confirmada: false,
        confianza: 'medido',
        bonos: [{ stat: 'ps', descripcion: 'ps', porcentaje: 4 }]
      }
    ],
    objeto: null,
    version_desconocida: true,
    avisos: [CAMBIO_DE_API],
    sin_datos: []
  }
}

export function potencialDeReferencia(): Potencial {
  const stats = Object.fromEntries(
    STATS.map(({ codigo }) => [codigo, statDePotencial(STATS_DE_IRISALIS[codigo])])
  ) as Record<CodigoDeStat, PotencialDeStat>
  return {
    version: 'ejemplo-2',
    esEjemplo: true,
    fechaParche: '2026-09-23',
    potencial: {
      confianza: 'medido',
      porPunto: 0.8,
      saltoCada: 4,
      saltoPorcentaje: 4,
      cuentaEstrella: true,
      cuentaObjeto: true,
      stats
    },
    despertar: {
      confianza: 'medido',
      cupoSugerido: 43,
      desglose: [
        { origen: 'nivel', detalle: 'nivel 1', suma: 5 },
        { origen: 'nivel', detalle: 'nivel 45', suma: 5 },
        { origen: 'nivel', detalle: 'nivel 55', suma: 10 },
        { origen: 'nivel', detalle: 'nivel 60', suma: 10 },
        { origen: 'etapa', detalle: 'etapa 5', suma: 5 },
        { origen: 'etapa', detalle: 'etapa 6', suma: 8 }
      ],
      totalCargado: 43,
      diferencia: 0,
      restantes: 15
    },
    personalidad: [
      {
        letra: 'E',
        nombre: 'Energetic',
        letraConfirmada: true,
        confianza: 'medido',
        bonos: [
          { stat: 'atq', descripcion: 'atq', porcentaje: 2 },
          { stat: 'quiebre', descripcion: 'quiebre', porcentaje: 2 }
        ]
      },
      {
        letra: 'N',
        nombre: 'Nimble',
        letraConfirmada: true,
        confianza: 'medido',
        bonos: [{ stat: null, descripcion: 'Prob. de critico', porcentaje: 5 }]
      },
      {
        letra: 'F',
        nombre: 'Faithful',
        letraConfirmada: false,
        confianza: 'medido',
        bonos: [{ stat: 'def_magica', descripcion: 'def_magica', porcentaje: 6 }]
      },
      {
        letra: 'J',
        nombre: 'Judicious',
        letraConfirmada: false,
        confianza: 'medido',
        bonos: [{ stat: 'ps', descripcion: 'ps', porcentaje: 4 }]
      }
    ],
    objeto: null,
    versionDesconocida: true,
    avisos: [
      { fecha: '2026-09-23', descripcion: 'Actualizacion del 23/09', confianza: 'fan' }
    ],
    sinDatos: []
  }
}
