import type { Ficha, FichaEntrada } from '../../src/shared/teams'

export function fichaDeReferencia(): FichaEntrada {
  return {
    nombre: 'Irisalis',
    elemento: 'hielo',
    rol: 'curacion',
    potencialInnato: 'perfecto',
    personalidad: 'ENFJ',
    nivel: 60,
    cp: 3475,
    stats: {
      ps: { valorActual: 11321, potencial: 11, bonoEstrellasIncluido: 120, notas: null },
      atq: { valorActual: 723, potencial: 20, bonoEstrellasIncluido: 0, notas: 'Tope de potencial' },
      def_fisica: { valorActual: 258, potencial: 5, bonoEstrellasIncluido: 0, notas: null },
      def_magica: { valorActual: 270, potencial: 4, bonoEstrellasIncluido: 0, notas: null },
      regen: { valorActual: 388, potencial: 20, bonoEstrellasIncluido: 15, notas: null },
      quiebre: { valorActual: 309, potencial: 6, bonoEstrellasIncluido: 0, notas: null }
    },
    entrenamiento: {
      estrellaActual: 2,
      nivelRequeridoSiguienteEtapa: 65,
      gananciaDespertar: 3,
      gananciaSeisPotenciales: 1,
      despertaresUsados: 28,
      despertaresTotal: 43,
      materiales: [
        { posicion: 1, nombre: 'Polvo estelar', tengo: 413, necesito: 60 },
        { posicion: 2, nombre: 'Fragmento', tengo: 1, necesito: 2 },
        { posicion: 3, nombre: 'Esencia', tengo: 3, necesito: 10 }
      ]
    },
    objetos: [
      {
        posicion: 'equipado',
        nombre: 'Corona antigua',
        rareza: 'legendaria',
        nivel: 15,
        contrato: true,
        efectoNucleoNotas: 'Efecto de nucleo de prueba'
      },
      {
        posicion: 'alternativo',
        nombre: 'Anillo simple',
        rareza: 'rara',
        nivel: 4,
        contrato: false,
        efectoNucleoNotas: null
      }
    ],
    notasHabilidades: 'Habilidad 1: ataque electrico | Habilidad 2: curacion',
    notas: 'Aniimo de referencia'
  }
}

export function fichaGuardadaDeReferencia(): Ficha {
  return { ...fichaDeReferencia(), slot: 1, tieneImagen: false }
}

function statDeApi(
  valor: number,
  potencial: number,
  bono: number,
  notas: string | null
): Record<string, unknown> {
  return { valor_actual: valor, potencial, bono_estrellas_incluido: bono, notas }
}

export function fichaDeApiDeReferencia(): Record<string, unknown> {
  return { slot: 1, tiene_imagen: false, ...entradaDeApiDeReferencia() }
}

export function entradaDeApiDeReferencia(): Record<string, unknown> {
  return {
    nombre: 'Irisalis',
    elemento: 'hielo',
    rol: 'curacion',
    potencial_innato: 'perfecto',
    personalidad: 'ENFJ',
    nivel: 60,
    cp: 3475,
    stats: {
      ps: statDeApi(11321, 11, 120, null),
      atq: statDeApi(723, 20, 0, 'Tope de potencial'),
      def_fisica: statDeApi(258, 5, 0, null),
      def_magica: statDeApi(270, 4, 0, null),
      regen: statDeApi(388, 20, 15, null),
      quiebre: statDeApi(309, 6, 0, null)
    },
    entrenamiento: {
      estrella_actual: 2,
      nivel_requerido_siguiente_etapa: 65,
      ganancia_despertar: 3,
      ganancia_seis_potenciales: 1,
      despertares_total: 43,
      despertares_usados: 28,
      materiales: [
        { posicion: 1, nombre: 'Polvo estelar', tengo: 413, necesito: 60 },
        { posicion: 2, nombre: 'Fragmento', tengo: 1, necesito: 2 },
        { posicion: 3, nombre: 'Esencia', tengo: 3, necesito: 10 }
      ]
    },
    objetos: [
      {
        posicion: 'equipado',
        nombre: 'Corona antigua',
        rareza: 'legendaria',
        nivel: 15,
        contrato: true,
        efecto_nucleo_notas: 'Efecto de nucleo de prueba'
      },
      {
        posicion: 'alternativo',
        nombre: 'Anillo simple',
        rareza: 'rara',
        nivel: 4,
        contrato: false,
        efecto_nucleo_notas: null
      }
    ],
    notas_habilidades: 'Habilidad 1: ataque electrico | Habilidad 2: curacion',
    notas: 'Aniimo de referencia'
  }
}
