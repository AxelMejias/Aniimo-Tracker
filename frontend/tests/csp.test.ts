import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const html = readFileSync(resolve(__dirname, '../src/renderer/index.html'), 'utf-8')

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
})
