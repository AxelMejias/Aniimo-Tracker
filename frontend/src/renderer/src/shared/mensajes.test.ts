import { describe, expect, it } from 'vitest'
import { mensajeDeError } from '../features/auth/mensajes'
import { mensajeDeErrorDeCalculo } from '../features/calculo/mensajes'
import {
  MENSAJE_NOMBRE_DE_USUARIO_INVALIDO as MENSAJE_DE_AMIGOS,
  mensajeDeErrorDeAmigos,
} from '../features/friends/mensajes'
import { mensajeDeErrorDeTeams } from '../features/teams/mensajes'
import {
  MENSAJE_ERROR_INESPERADO,
  MENSAJE_NOMBRE_DE_USUARIO_INVALIDO,
  MENSAJE_SESION_VENCIDA,
  MENSAJE_SIN_CONEXION,
} from './mensajes'

describe('mensajes comunes', () => {
  it('el texto de sin conexión orienta a revisar el backend', () => {
    expect(MENSAJE_SIN_CONEXION).toBe(
      'No se pudo conectar con el servidor. Revisá que el backend esté levantado.',
    )
  })

  it.each([
    ['auth', () => mensajeDeError({ ok: false, error: 'sin-conexion' })],
    [
      'teams',
      () => mensajeDeErrorDeTeams({ ok: false, error: 'sin-conexion' }),
    ],
    [
      'amigos',
      () => mensajeDeErrorDeAmigos({ ok: false, error: 'sin-conexion' }),
    ],
    ['cálculo', () => mensajeDeErrorDeCalculo('sin-conexion')]
  ])('%s usa el mismo texto de sin conexión', (_nombre, obtener) => {
    expect(obtener()).toBe(MENSAJE_SIN_CONEXION)
  })

  it.each([
    ['auth', () => mensajeDeError({ ok: false, error: 'sesion-vencida' })],
    [
      'teams',
      () => mensajeDeErrorDeTeams({ ok: false, error: 'sesion-vencida' }),
    ],
    [
      'amigos',
      () => mensajeDeErrorDeAmigos({ ok: false, error: 'sesion-vencida' }),
    ],
    ['cálculo', () => mensajeDeErrorDeCalculo('sesion-vencida')]
  ])('%s usa el mismo texto de sesión vencida', (_nombre, obtener) => {
    expect(obtener()).toBe(MENSAJE_SESION_VENCIDA)
  })

  it.each([
    ['auth', () => mensajeDeError({ ok: false, error: 'error-inesperado' })],
    [
      'teams',
      () => mensajeDeErrorDeTeams({ ok: false, error: 'error-inesperado' }),
    ],
    [
      'amigos',
      () => mensajeDeErrorDeAmigos({ ok: false, error: 'error-inesperado' }),
    ],
    ['cálculo', () => mensajeDeErrorDeCalculo('error-inesperado')]
  ])('%s usa el mismo texto de error inesperado', (_nombre, obtener) => {
    expect(obtener()).toBe(MENSAJE_ERROR_INESPERADO)
  })

  it('amigos reutiliza la regla del nombre de usuario', () => {
    expect(MENSAJE_DE_AMIGOS).toBe(MENSAJE_NOMBRE_DE_USUARIO_INVALIDO)
    expect(
      mensajeDeErrorDeAmigos({ ok: false, error: 'datos-invalidos' }),
    ).toBe(MENSAJE_NOMBRE_DE_USUARIO_INVALIDO)
  })
})
