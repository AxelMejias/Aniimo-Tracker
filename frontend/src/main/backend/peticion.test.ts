import { describe, expect, it, vi } from 'vitest'
import { crearSesionEnMemoria } from '../auth/sesionEnMemoria'
import { crearPeticion, urlBaseDelBackend, URL_BASE_BACKEND } from './peticion'

describe('urlBaseDelBackend', () => {
  it('empaquetado usa el puerto 8001', () => {
    expect(urlBaseDelBackend(true)).toBe('http://127.0.0.1:8001/api')
  })

  it('en desarrollo usa el puerto 8000', () => {
    expect(urlBaseDelBackend(false)).toBe('http://127.0.0.1:8000/api')
  })

  it('siempre es loopback', () => {
    expect(urlBaseDelBackend(true).startsWith('http://127.0.0.1:')).toBe(true)
    expect(urlBaseDelBackend(false).startsWith('http://127.0.0.1:')).toBe(true)
  })
})

describe('crearPeticion', () => {
  it('sin base explicita usa la de desarrollo', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    await crearPeticion(fetchFalso, crearSesionEnMemoria())('GET', '/health')
    expect(fetchFalso.mock.calls[0]?.[0]).toBe(`${URL_BASE_BACKEND}/health`)
    expect(URL_BASE_BACKEND).toBe('http://127.0.0.1:8000/api')
  })

  it('con la base empaquetada llama al puerto 8001', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    await crearPeticion(fetchFalso, crearSesionEnMemoria(), urlBaseDelBackend(true))('GET', '/health')
    expect(fetchFalso.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8001/api/health')
  })
})
