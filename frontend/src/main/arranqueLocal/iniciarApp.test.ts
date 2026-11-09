import { describe, expect, it, vi } from 'vitest'
import { iniciarApp, type DependenciasDeInicio } from './iniciarApp'
import type { ErrorDeArranque, ResultadoDeArranque } from './secuenciaDeArranque'

function armar(
  empaquetado: boolean,
  resultados: ResultadoDeArranque[],
  elecciones: ('reintentar' | 'salir')[] = []
) {
  const eventos: string[] = []
  const arrancar = vi.fn(async () => {
    eventos.push('arrancar')
    return resultados.shift() ?? { tipo: 'listo' as const }
  })
  const dependencias: DependenciasDeInicio = {
    empaquetado,
    secuencia: { arrancar, detener: vi.fn() },
    mostrarArranque: () => eventos.push('mostrar-arranque'),
    ocultarArranque: () => eventos.push('ocultar-arranque'),
    preguntar: async (error: ErrorDeArranque) => {
      eventos.push(`error ${error}`)
      return elecciones.shift() ?? 'salir'
    },
    abrirPrincipal: () => eventos.push('abrir-principal'),
    salir: () => eventos.push('salir')
  }
  return { dependencias, eventos, arrancar }
}

describe('iniciarApp', () => {
  it('en desarrollo abre la ventana principal sin llamar a la secuencia', async () => {
    const { dependencias, eventos, arrancar } = armar(false, [])
    await iniciarApp(dependencias)
    expect(arrancar).not.toHaveBeenCalled()
    expect(eventos).toEqual(['abrir-principal'])
  })

  it('empaquetada y con todo bien muestra el arranque y abre la principal al final', async () => {
    const { dependencias, eventos } = armar(true, [{ tipo: 'listo' }])
    await iniciarApp(dependencias)
    expect(eventos).toEqual(['mostrar-arranque', 'arrancar', 'ocultar-arranque', 'abrir-principal'])
  })

  it('ante un error pregunta y reintenta desde el principio', async () => {
    const { dependencias, eventos, arrancar } = armar(
      true,
      [{ tipo: 'error', error: 'docker-detenido' }, { tipo: 'listo' }],
      ['reintentar']
    )
    await iniciarApp(dependencias)
    expect(arrancar).toHaveBeenCalledTimes(2)
    expect(eventos).toEqual([
      'mostrar-arranque',
      'arrancar',
      'ocultar-arranque',
      'error docker-detenido',
      'mostrar-arranque',
      'arrancar',
      'ocultar-arranque',
      'abrir-principal'
    ])
  })

  it('si el usuario elige salir no abre la principal', async () => {
    const { dependencias, eventos } = armar(true, [{ tipo: 'error', error: 'puerto-ocupado' }], [
      'salir'
    ])
    await iniciarApp(dependencias)
    expect(eventos).toContain('salir')
    expect(eventos).not.toContain('abrir-principal')
  })
})

describe('iniciarApp en segundo plano', () => {
  function armarEnSegundoPlano(resultados: ResultadoDeArranque[], elecciones: ('reintentar' | 'salir')[] = []) {
    const base = armar(true, resultados, elecciones)
    const eventos = base.eventos
    let reloj = 0
    const dependencias: DependenciasDeInicio = {
      ...base.dependencias,
      segundoPlano: {
        alListo: () => eventos.push('listo-en-segundo-plano'),
        dormir: async (ms) => {
          reloj += ms
          eventos.push(`dormir ${ms}`)
        },
        ahora: () => reloj
      }
    }
    return { dependencias, eventos, arrancar: base.arrancar }
  }

  it('no muestra la ventana de arranque ni la principal cuando todo sale bien', async () => {
    const { dependencias, eventos } = armarEnSegundoPlano([{ tipo: 'listo' }])
    await iniciarApp(dependencias)
    expect(eventos).toEqual(['arrancar', 'listo-en-segundo-plano'])
  })

  it('reintenta en silencio mientras Docker no responde', async () => {
    const { dependencias, eventos, arrancar } = armarEnSegundoPlano([
      { tipo: 'error', error: 'docker-detenido' },
      { tipo: 'error', error: 'docker-detenido' },
      { tipo: 'listo' }
    ])
    await iniciarApp(dependencias)
    expect(arrancar).toHaveBeenCalledTimes(3)
    expect(eventos.some((evento) => evento.startsWith('error'))).toBe(false)
    expect(eventos.at(-1)).toBe('listo-en-segundo-plano')
  })

  it('despues de 2 minutos sin Docker muestra el dialogo de error', async () => {
    const siempreDetenido: ResultadoDeArranque[] = Array.from({ length: 500 }, () => ({
      tipo: 'error' as const,
      error: 'docker-detenido' as const
    }))
    const { dependencias, eventos } = armarEnSegundoPlano(siempreDetenido, ['salir'])
    await iniciarApp(dependencias)
    expect(eventos).toContain('error docker-detenido')
    expect(eventos).toContain('salir')
    const esperado = eventos
      .filter((evento) => evento.startsWith('dormir'))
      .reduce((total, evento) => total + Number(evento.split(' ')[1]), 0)
    expect(esperado).toBeGreaterThanOrEqual(120_000)
    expect(esperado).toBeLessThan(130_000)
  })

  it('otros errores van directo al dialogo sin reintento silencioso', async () => {
    const { dependencias, eventos } = armarEnSegundoPlano(
      [{ tipo: 'error', error: 'puerto-ocupado' }],
      ['salir']
    )
    await iniciarApp(dependencias)
    expect(eventos).toEqual(['arrancar', 'error puerto-ocupado', 'salir'])
  })
})

