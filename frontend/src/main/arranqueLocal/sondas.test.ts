import { createServer, type Server } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { backendSaludable, puertoRespondiendo } from './sondas'

let servidor: Server | null = null

afterEach(async () => {
  const actual = servidor
  servidor = null
  if (actual !== null) {
    await new Promise<void>((resolver) => actual.close(() => resolver()))
  }
})

async function escucharEnUnPuertoLibre(): Promise<number> {
  const nuevo = createServer()
  servidor = nuevo
  await new Promise<void>((resolver) => nuevo.listen(0, '127.0.0.1', resolver))
  const direccion = nuevo.address()
  if (direccion === null || typeof direccion === 'string') {
    throw new Error('sin direccion')
  }
  return direccion.port
}

describe('puertoRespondiendo', () => {
  it('es true cuando algo escucha en el puerto', async () => {
    const puerto = await escucharEnUnPuertoLibre()
    expect(await puertoRespondiendo(puerto)).toBe(true)
  })

  it('es false cuando nadie escucha', async () => {
    const puerto = await escucharEnUnPuertoLibre()
    await new Promise<void>((resolver) => servidor?.close(() => resolver()))
    servidor = null
    expect(await puertoRespondiendo(puerto)).toBe(false)
  })
})

describe('backendSaludable', () => {
  it('pide /health del backend y es true con 200', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    expect(await backendSaludable(fetchFalso, 'http://127.0.0.1:8001/api')).toBe(true)
    expect(fetchFalso.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8001/api/health')
  })

  it('es false con otro estado', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('', { status: 503 }))
    expect(await backendSaludable(fetchFalso, 'http://127.0.0.1:8001/api')).toBe(false)
  })

  it('es false si la conexion falla', async () => {
    const fetchFalso = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await backendSaludable(fetchFalso, 'http://127.0.0.1:8001/api')).toBe(false)
  })
})
