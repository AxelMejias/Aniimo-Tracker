import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync(
  resolve(__dirname, '../src/renderer/src/shared/styles/tokens.css'),
  'utf-8'
)

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (canales[0] ?? 0) + 0.7152 * (canales[1] ?? 0) + 0.0722 * (canales[2] ?? 0)
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return ((claro ?? 0) + 0.05) / ((oscuro ?? 0) + 0.05)
}

function bloqueOscuro(css: string): string {
  const inicio = css.indexOf('@media (prefers-color-scheme: dark)')
  if (inicio === -1) return ''
  const apertura = css.indexOf('{', inicio)
  let nivel = 0
  for (let i = apertura; i < css.length; i++) {
    if (css[i] === '{') nivel++
    if (css[i] === '}') nivel--
    if (nivel === 0) return css.slice(apertura + 1, i)
  }
  return ''
}

function colores(css: string): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    mapa.set(m[1] ?? '', m[2] ?? '')
  }
  return mapa
}

const OSCURO = bloqueOscuro(tokens)
const CLARO = colores(tokens.replace(OSCURO, ''))
const TEMAS: readonly { readonly nombre: string; readonly valores: Map<string, string> }[] = [
  { nombre: 'claro', valores: CLARO },
  { nombre: 'oscuro', valores: new Map([...CLARO, ...colores(OSCURO)]) }
]

const SUPERFICIES = ['--color-background', '--color-surface', '--color-surface-elevated']

const PARES_DE_TEXTO: readonly (readonly [string, string])[] = [
  ...['--color-text', '--color-text-muted', '--color-accent'].flatMap(
    (texto) => SUPERFICIES.map((fondo) => [texto, fondo] as const)
  ),
  ['--color-on-accent', '--color-accent'],
  ...['--color-error', '--color-success', '--color-warning'].flatMap((texto) =>
    ['--color-background', '--color-surface'].map((fondo) => [texto, fondo] as const)
  ),
  ['--color-title', '--color-background'],
  ['--color-carta-texto', '--color-carta-banda'],
  ['--color-portada', '--color-carta-banda'],
  ['--color-text', '--color-carta-placa'],
  ['--color-text-muted', '--color-carta-placa'],
  ['--color-lateral-texto', '--color-lateral'],
  ['--color-lateral-texto-muted', '--color-lateral'],
  ['--color-nav-activa-texto', '--color-nav-activa'],
  ['--color-on-accent', '--color-accent-hover']
]

const PARES_NO_TEXTUALES: readonly (readonly [string, string])[] = [
  ...['--color-focus', '--color-border-control'].flatMap((elemento) =>
    ['--color-background', '--color-surface'].map((fondo) => [elemento, fondo] as const)
  )
]

describe('funcion de contraste WCAG', () => {
  it('negro sobre blanco da 21:1', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 5)
  })

  it('el mismo color da 1:1', () => {
    expect(contraste('#1f3a5f', '#1f3a5f')).toBeCloseTo(1, 5)
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('un gris medio sobre blanco da un valor intermedio conocido', () => {
    expect(contraste('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })
})

describe.each(TEMAS)('contraste AA en el tema $nombre', ({ valores }) => {
  function valor(nombre: string): string {
    const hex = valores.get(nombre)
    expect(hex, `falta ${nombre}`).toBeDefined()
    return hex ?? '#000000'
  }

  it.each(PARES_DE_TEXTO)('texto %s sobre %s da 4.5:1 o mas', (texto, fondo) => {
    expect(contraste(valor(texto), valor(fondo))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(PARES_NO_TEXTUALES)('%s sobre %s da 3:1 o mas', (elemento, fondo) => {
    expect(contraste(valor(elemento), valor(fondo))).toBeGreaterThanOrEqual(3)
  })
})
