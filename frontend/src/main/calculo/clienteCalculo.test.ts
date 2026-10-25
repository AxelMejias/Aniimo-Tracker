import { describe, expect, it, vi } from 'vitest'
import {
  catalogoDeApiDeReferencia,
  catalogoDeReferencia,
  pedidoDeApiDeReferencia,
  pedidoDeReferencia,
  sugerenciaDeApiDeReferencia,
  sugerenciaDeReferencia
} from '../../../tests/fixtures/calculo'
import { crearSesionEnMemoria } from '../auth/sesionEnMemoria'
import { URL_BASE_BACKEND, type FetchFn } from '../backend/peticion'
import { crearClienteCalculo } from './clienteCalculo'

type Respuesta = Response | Error

function json(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json' }
  })
}

function preparar(...respuestas: Respuesta[]) {
  const cola = [...respuestas]
  const fetchFalso = vi.fn<FetchFn>(async () => {
    const siguiente = cola.shift()
    if (siguiente === undefined) {
      throw new Error('fetch inesperado')
    }
    if (siguiente instanceof Error) {
      throw siguiente
    }
    return siguiente
  })
  const sesion = crearSesionEnMemoria()
  sesion.guardar('tok-123', 'axel')
  return { cliente: crearClienteCalculo(fetchFalso, sesion), fetchFalso, sesion }
}

function llamada(fetchFalso: ReturnType<typeof preparar>['fetchFalso']) {
  const [url, init] = fetchFalso.mock.calls[0] ?? []
  return {
    url: String(url),
    metodo: init?.method,
    cabeceras: new Headers(init?.headers),
    cuerpo: init?.body
  }
}

describe('obtenerCatalogo', () => {
  it('pide GET /calculo/catalogo con el token y traduce la respuesta', async () => {
    const { cliente, fetchFalso } = preparar(json(200, catalogoDeApiDeReferencia()))

    const resultado = await cliente.obtenerCatalogo()

    expect(resultado).toEqual({ ok: true, catalogo: catalogoDeReferencia() })
    const enviada = llamada(fetchFalso)
    expect(enviada.url).toBe(`${URL_BASE_BACKEND}/calculo/catalogo`)
    expect(enviada.metodo).toBe('GET')
    expect(enviada.cabeceras.get('Authorization')).toBe('Bearer tok-123')
    expect(JSON.stringify(resultado)).not.toContain('tok-123')
  })
})

describe('calcular', () => {
  it('manda el cuerpo en snake_case con el token y traduce la sugerencia', async () => {
    const { cliente, fetchFalso } = preparar(json(200, sugerenciaDeApiDeReferencia()))

    const resultado = await cliente.calcular(pedidoDeReferencia())

    expect(resultado).toEqual({ ok: true, sugerencia: sugerenciaDeReferencia() })
    const enviada = llamada(fetchFalso)
    expect(enviada.url).toBe(`${URL_BASE_BACKEND}/calculo/stats`)
    expect(enviada.metodo).toBe('POST')
    expect(enviada.cabeceras.get('Authorization')).toBe('Bearer tok-123')
    expect(JSON.parse(String(enviada.cuerpo))).toEqual(pedidoDeApiDeReferencia())
  })

  it('envia null para la personalidad y el objeto sin elegir', async () => {
    const { cliente, fetchFalso } = preparar(json(200, sugerenciaDeApiDeReferencia()))

    await cliente.calcular({
      ...pedidoDeReferencia(),
      personalidad: null,
      objetos: [{ posicion: 'equipado', objetoId: null, nivel: 2 }]
    })

    const cuerpo = JSON.parse(String(llamada(fetchFalso).cuerpo))
    expect(cuerpo.personalidad).toBeNull()
    expect(cuerpo.objetos).toEqual([{ posicion: 'equipado', objeto_id: null, nivel: 2 }])
  })
})

describe.each([
  ['obtenerCatalogo', (c: ReturnType<typeof preparar>['cliente']) => c.obtenerCatalogo()],
  ['calcular', (c: ReturnType<typeof preparar>['cliente']) => c.calcular(pedidoDeReferencia())]
])('errores de %s', (_nombre, ejecutar) => {
  it('401 borra la sesion y devuelve sesion-vencida', async () => {
    const { cliente, sesion } = preparar(json(401, { detail: 'No autenticado' }))

    expect(await ejecutar(cliente)).toEqual({ ok: false, error: 'sesion-vencida' })
    expect(sesion.obtener()).toBeNull()
  })

  it('503 devuelve no-disponible y conserva la sesion', async () => {
    const { cliente, sesion } = preparar(json(503, { detail: 'no disponible' }))

    expect(await ejecutar(cliente)).toEqual({ ok: false, error: 'no-disponible' })
    expect(sesion.obtener()).not.toBeNull()
  })

  it('un fallo de red devuelve sin-conexion', async () => {
    const { cliente } = preparar(new TypeError('fetch failed'))

    expect(await ejecutar(cliente)).toEqual({ ok: false, error: 'sin-conexion' })
  })

  it('un estado inesperado devuelve error-inesperado', async () => {
    const { cliente } = preparar(json(500, { detail: 'Error interno del servidor' }))

    expect(await ejecutar(cliente)).toEqual({ ok: false, error: 'error-inesperado' })
  })

  it('un 200 con cuerpo que no es JSON devuelve error-inesperado', async () => {
    const { cliente } = preparar(new Response('no es json', { status: 200 }))

    expect(await ejecutar(cliente)).toEqual({ ok: false, error: 'error-inesperado' })
  })
})

describe('422 de calcular', () => {
  it('por especie desconocida devuelve especie-desconocida', async () => {
    const { cliente } = preparar(
      json(422, {
        detail: [
          {
            loc: ['body', 'especie_id'],
            msg: "Valor inválido en el campo 'especie_id'",
            type: 'valor_invalido'
          }
        ]
      })
    )

    expect(await cliente.calcular(pedidoDeReferencia())).toEqual({
      ok: false,
      error: 'especie-desconocida'
    })
  })

  it('por cualquier otro motivo devuelve datos-invalidos', async () => {
    const { cliente } = preparar(
      json(422, {
        detail: [{ loc: ['body', 'nivel'], msg: 'Input should be a valid integer', type: 'int_type' }]
      })
    )

    expect(await cliente.calcular(pedidoDeReferencia())).toEqual({
      ok: false,
      error: 'datos-invalidos'
    })
  })

  it('con un cuerpo ilegible devuelve datos-invalidos', async () => {
    const { cliente } = preparar(new Response('???', { status: 422 }))

    expect(await cliente.calcular(pedidoDeReferencia())).toEqual({
      ok: false,
      error: 'datos-invalidos'
    })
  })
})

describe('respuestas mal formadas', () => {
  it('un valor string es error-inesperado', async () => {
    const api = sugerenciaDeApiDeReferencia()
    const stats = api.stats as Record<string, Record<string, unknown>>
    const { cliente } = preparar(
      json(200, { ...api, stats: { ...stats, atq: { ...stats.atq, valor: '458' } } })
    )

    expect(await cliente.calcular(pedidoDeReferencia())).toEqual({
      ok: false,
      error: 'error-inesperado'
    })
  })

  it('un cp.valor_con_objetos string es error-inesperado', async () => {
    const api = sugerenciaDeApiDeReferencia()
    const { cliente } = preparar(
      json(200, { ...api, cp: { ...(api.cp as object), valor_con_objetos: '629' } })
    )

    expect(await cliente.calcular(pedidoDeReferencia())).toEqual({
      ok: false,
      error: 'error-inesperado'
    })
  })

  it('un catalogo sin especies es error-inesperado', async () => {
    const { cliente } = preparar(json(200, { version: 'x', es_ejemplo: true }))

    expect(await cliente.obtenerCatalogo()).toEqual({ ok: false, error: 'error-inesperado' })
  })
})
