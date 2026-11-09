import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const html = readFileSync(resolve(__dirname, '../src/renderer/index.html'), 'utf-8')
const htmlDeArranque = readFileSync(resolve(__dirname, '../src/renderer/arranque.html'), 'utf-8')

function extractCsp(markup: string): string {
  const match = markup.match(
    /<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i
  )
  expect(match, 'No se encontró la meta CSP en index.html').not.toBeNull()
  return match?.[1] ?? ''
}

describe('renderer CSP', () => {
  const csp = extractCsp(html)

  it("includes default-src 'self'", () => {
    expect(csp).toContain("default-src 'self'")
  })

  it("includes script-src 'self'", () => {
    expect(csp).toContain("script-src 'self'")
  })

  it("includes object-src 'none'", () => {
    expect(csp).toContain("object-src 'none'")
  })

  it("does not allow 'unsafe-eval'", () => {
    expect(csp).not.toContain("'unsafe-eval'")
  })

  it('does not name remote origins', () => {
    expect(csp).not.toMatch(/https?:/)
    expect(csp).not.toMatch(/(?:\*\.)?[a-z0-9-]+\.[a-z]{2,}/i)
  })

  it("limits font-src to 'self' when declared", () => {
    const fuentes = csp.match(/font-src([^;]*)/)
    if (fuentes !== null) {
      expect((fuentes[1] ?? '').trim()).toBe("'self'")
    }
  })

  it('names no origin in any directive besides self, none, data and unsafe-inline', () => {
    const valores = csp
      .split(';')
      .flatMap((directiva) => directiva.trim().split(/\s+/).slice(1))
      .filter((valor) => valor !== '')
    for (const valor of valores) {
      expect(["'self'", "'none'", 'data:', "'unsafe-inline'"]).toContain(valor)
    }
  })
})

describe('ventana de arranque', () => {
  it('usa la misma CSP que la app', () => {
    expect(extractCsp(htmlDeArranque)).toBe(extractCsp(html))
  })

  it('no carga scripts', () => {
    expect(htmlDeArranque).not.toMatch(/<script/i)
  })
})
