import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(__dirname, '../src/renderer/src/features/overlay/overlay.css'), 'utf-8')

describe('estilos del overlay', () => {
  it('el selector de team queda fuera de la zona de arrastre de la barra', () => {
    expect(css).toMatch(/\.overlay__selector\s*\{[^}]*-webkit-app-region:\s*no-drag/)
  })

  it('la barra sigue siendo la zona de arrastre', () => {
    expect(css).toMatch(/\.overlay__barra\s*\{[^}]*-webkit-app-region:\s*drag/)
  })

  it('las acciones de la barra quedan fuera de la zona de arrastre', () => {
    expect(css).toMatch(/\.overlay__acciones\s*\{[^}]*-webkit-app-region:\s*no-drag/)
  })

  it('no usa tamanos de letra fijos ni colores literales', () => {
    expect(css).not.toMatch(/font-size:\s*[\d.]+(px|rem)/)
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i)
  })
})
