import { describe, expect, it } from 'vitest'
import {
  MAXIMO_DE_GRUPOS,
  MAXIMO_DE_TEAMS,
  MAXIMO_DE_TEAMS_POR_GRUPO,
  MENSAJE_GRUPO_LLENO,
  MENSAJE_MAXIMO_DE_GRUPOS,
  MENSAJE_MAXIMO_DE_TEAMS
} from './teams'

describe('limites y textos compartidos con el backend', () => {
  it('los maximos son 20 teams, 4 grupos y 5 teams por grupo', () => {
    expect(MAXIMO_DE_TEAMS).toBe(20)
    expect(MAXIMO_DE_GRUPOS).toBe(4)
    expect(MAXIMO_DE_TEAMS_POR_GRUPO).toBe(5)
  })

  it('los textos de los 409 coinciden letra por letra con los del backend', () => {
    expect(MENSAJE_MAXIMO_DE_TEAMS).toBe('Ya tenés el máximo de 20 teams')
    expect(MENSAJE_MAXIMO_DE_GRUPOS).toBe('Ya tenés el máximo de 4 grupos')
    expect(MENSAJE_GRUPO_LLENO).toBe('Ese grupo ya tiene el máximo de 5 teams')
  })
})
