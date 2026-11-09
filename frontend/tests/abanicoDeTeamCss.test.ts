import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const raiz = resolve(__dirname, '../src/renderer/src')
const tokens = readFileSync(resolve(raiz, 'shared/styles/tokens.css'), 'utf-8')
const mazo = readFileSync(resolve(raiz, 'features/mazo/mazo.css'), 'utf-8')
const teams = readFileSync(resolve(raiz, 'features/teams/teams.css'), 'utf-8')

describe('abanico de cartas de un team', () => {
  it('los tokens tienen una transform por carta para 1 a 4 cartas', () => {
    for (let n = 1; n <= 4; n++) {
      for (let c = 1; c <= n; c++) {
        expect(tokens).toMatch(new RegExp(`--abanico-team-n${n}-c${c}-transform:`))
        expect(mazo).toContain(`var(--abanico-team-n${n}-c${c}-transform)`)
      }
    }
  })

  it('el movimiento sale de los tokens del abanico de grupos', () => {
    expect(mazo).toMatch(/\.pila__flotante\s*\{[^}]*var\(--movimiento-abanico-duracion\)[^}]*var\(--movimiento-abanico-curva\)/)
  })

  it('con prefers-reduced-motion no hay animacion', () => {
    const reducido = mazo.slice(mazo.indexOf('prefers-reduced-motion'))
    expect(reducido).toMatch(/\.pila__flotante[^}]*animation:\s*none/)
  })

  it('la pila abierta queda por encima y el espacio de las cartas esta reservado', () => {
    expect(mazo).toMatch(/\.pila\.pila--desplegada[^{]*\{[^}]*z-index/)
    expect(teams).toMatch(/\.mazo__pilas\s*\{[^}]*padding[^}]*var\(--abanico-team-margen/)
  })

  it('las reglas no usan colores ni sombras literales', () => {
    const reglas = mazo.slice(mazo.indexOf('.pila__abanico'))
    expect(reglas).not.toMatch(/#[0-9a-f]{3,8}/i)
    expect(reglas).not.toMatch(/rgba?\(/)
  })
})
