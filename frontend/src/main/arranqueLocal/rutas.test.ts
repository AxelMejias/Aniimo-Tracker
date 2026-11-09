import { describe, expect, it } from 'vitest'
import { rutasDeArranque } from './rutas'

const DATOS = String.raw`C:\Users\Ana\AppData\Roaming\Aniimo Team Tracker`
const RECURSOS = String.raw`C:\Users\Ana\AppData\Local\Programs\Aniimo Team Tracker\resources`

describe('rutasDeArranque', () => {
  it('arma las rutas de datos y de recursos', () => {
    expect(rutasDeArranque(DATOS, RECURSOS)).toEqual({
      composeEnv: `${DATOS}\\compose.env`,
      carpetaDelBackend: `${DATOS}\\backend`,
      backendEnv: `${DATOS}\\backend\\.env`,
      carpetaDeLogs: `${DATOS}\\logs`,
      log: `${DATOS}\\logs\\backend.log`,
      logAnterior: `${DATOS}\\logs\\backend.anterior.log`,
      compose: `${RECURSOS}\\docker-compose.app.yml`,
      backendExe: `${RECURSOS}\\aniimo-backend\\aniimo-backend.exe`
    })
  })

  it('funciona con rutas con espacios y otra unidad', () => {
    const rutas = rutasDeArranque(
      String.raw`D:\Mis Datos\Aniimo`,
      String.raw`D:\Archivos de programa\Aniimo\resources`
    )
    expect(rutas.backendEnv).toBe(String.raw`D:\Mis Datos\Aniimo\backend\.env`)
    expect(rutas.log).toBe(String.raw`D:\Mis Datos\Aniimo\logs\backend.log`)
    expect(rutas.backendExe).toBe(
      String.raw`D:\Archivos de programa\Aniimo\resources\aniimo-backend\aniimo-backend.exe`
    )
  })
})
