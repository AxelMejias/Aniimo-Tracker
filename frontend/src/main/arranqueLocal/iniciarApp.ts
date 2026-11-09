import type { ErrorDeArranque, SecuenciaDeArranque } from './secuenciaDeArranque'

export type SegundoPlanoDeInicio = {
  readonly alListo: () => void
  readonly dormir: (milisegundos: number) => Promise<void>
  readonly ahora: () => number
}

export type DependenciasDeInicio = {
  readonly empaquetado: boolean
  readonly secuencia: SecuenciaDeArranque
  readonly mostrarArranque: () => void
  readonly ocultarArranque: () => void
  readonly preguntar: (error: ErrorDeArranque) => Promise<'reintentar' | 'salir'>
  readonly abrirPrincipal: () => void
  readonly salir: () => void
  readonly segundoPlano?: SegundoPlanoDeInicio
}

const ESPERA_DE_DOCKER_MS = 120_000
const PAUSA_ENTRE_REINTENTOS_MS = 2_000

export async function iniciarApp(deps: DependenciasDeInicio): Promise<void> {
  if (!deps.empaquetado) {
    deps.abrirPrincipal()
    return
  }
  const { segundoPlano } = deps
  const inicio = segundoPlano?.ahora() ?? 0
  for (;;) {
    if (segundoPlano === undefined) {
      deps.mostrarArranque()
    }
    const resultado = await deps.secuencia.arrancar()
    if (segundoPlano === undefined) {
      deps.ocultarArranque()
    }
    if (resultado.tipo === 'listo') {
      if (segundoPlano === undefined) {
        deps.abrirPrincipal()
      } else {
        segundoPlano.alListo()
      }
      return
    }
    if (
      segundoPlano !== undefined &&
      resultado.error === 'docker-detenido' &&
      segundoPlano.ahora() - inicio < ESPERA_DE_DOCKER_MS
    ) {
      await segundoPlano.dormir(PAUSA_ENTRE_REINTENTOS_MS)
      continue
    }
    if ((await deps.preguntar(resultado.error)) === 'salir') {
      deps.salir()
      return
    }
  }
}
