import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = resolve(__dirname, '../src/renderer/src')
const TOKENS = join(RAIZ, 'shared/styles/tokens.css')
const BASE = join(RAIZ, 'shared/styles/base.css')

const COLORES_NOMBRADOS =
  'white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|silver|navy|teal|maroon|gold|brown|cyan|magenta|lime|olive|aqua|fuchsia'

interface Regla {
  readonly selector: string
  readonly declaraciones: string
}

function sinComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function reglas(css: string): Regla[] {
  const resultado: Regla[] = []
  for (const m of sinComentarios(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    resultado.push({ selector: (m[1] ?? '').trim(), declaraciones: m[2] ?? '' })
  }
  return resultado
}

function coloresLiterales(css: string): string[] {
  const patron = new RegExp(
    `#[0-9a-fA-F]{3,8}(?![\\w-])|\\b(?:rgba?|hsla?)\\(|(?<![\\w-])(?:${COLORES_NOMBRADOS})(?![\\w-])`,
    'g'
  )
  return reglas(css).flatMap(({ declaraciones }) =>
    declaraciones
      .split(';')
      .map((d) => d.slice(d.indexOf(':') + 1))
      .flatMap((valor) => valor.match(patron) ?? [])
  )
}

function recursosRemotos(css: string): string[] {
  return sinComentarios(css).match(/@import[^;]*(?:https?:)?\/\/[^;]*|url\(\s*['"]?(?:https?:)?\/\/[^)]*\)/g) ?? []
}

function outlinesQuitados(css: string): string[] {
  const control = /(?:^|[\s>+~,])(?:button|a|input|select|textarea)(?![\w-])/
  return reglas(css)
    .filter(
      ({ selector, declaraciones }) =>
        selector.split(',').some((s) => control.test(s.trim())) &&
        /outline\s*:\s*(?:none|0)\s*(?:;|$|!)/.test(declaraciones)
    )
    .map(({ selector }) => selector)
}

function duracionesLiterales(css: string): string[] {
  return [...sinComentarios(css).matchAll(/transition(?:-duration)?\s*:\s*([^;}]+)/g)]
    .map((m) => m[1] ?? '')
    .filter((valor) => /(?<![\w-])\d*\.?\d+m?s(?![\w-])/.test(valor.replace(/var\([^)]*\)/g, '')))
}

function archivosCss(): string[] {
  return (readdirSync(RAIZ, { recursive: true }) as string[])
    .filter((ruta) => ruta.endsWith('.css'))
    .map((ruta) => join(RAIZ, ruta))
}

function bloqueOscuro(tokens: string): string {
  const inicio = tokens.indexOf('@media (prefers-color-scheme: dark)')
  if (inicio === -1) return ''
  const apertura = tokens.indexOf('{', inicio)
  let nivel = 0
  for (let i = apertura; i < tokens.length; i++) {
    if (tokens[i] === '{') nivel++
    if (tokens[i] === '}') nivel--
    if (nivel === 0) return tokens.slice(apertura + 1, i)
  }
  return ''
}

function nombresDeTokens(css: string): string[] {
  return [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? '')
}

const CSS_DE_FEATURES = archivosCss().filter((ruta) => ruta !== TOKENS)

describe('detectores de estilo (casos armados a mano)', () => {
  it('detecta colores literales en una declaracion', () => {
    expect(coloresLiterales('.a { color: #fff; }')).toEqual(['#fff'])
    expect(coloresLiterales('.a { border: 1px solid rgba(0, 0, 0, .5); }')).toEqual(['rgba('])
    expect(coloresLiterales('.a { background: linear-gradient(red, #12345678); }')).toHaveLength(2)
  })

  it('no marca var(), transparent, currentColor ni nombres de clase', () => {
    expect(
      coloresLiterales(
        '.rojo { color: var(--color-red); background: transparent; border-color: currentColor; }'
      )
    ).toEqual([])
    expect(coloresLiterales('#root .a { color: var(--color-text); }')).toEqual([])
  })

  it('detecta recursos remotos', () => {
    expect(recursosRemotos("@import url('https://fonts.googleapis.com/css');")).toHaveLength(1)
    expect(recursosRemotos('.a { background: url(//cdn.example.com/x.png); }')).toHaveLength(1)
    expect(recursosRemotos('.a { background: url(./x.png); }')).toEqual([])
  })

  it('detecta outline quitado solo en controles', () => {
    expect(outlinesQuitados('button:focus { outline: none; }')).toEqual(['button:focus'])
    expect(outlinesQuitados('.x input, .y { outline: 0; }')).toHaveLength(1)
    expect(outlinesQuitados('.contenido:focus { outline: none; }')).toEqual([])
    expect(outlinesQuitados('.boton-grande { outline: none; }')).toEqual([])
  })

  it('detecta duraciones de transicion literales', () => {
    expect(duracionesLiterales('.a { transition: transform 280ms ease; }')).toHaveLength(1)
    expect(duracionesLiterales('.a { transition: transform var(--movimiento-duracion) var(--movimiento-curva); }')).toEqual([])
    expect(duracionesLiterales('.a { transition: none; }')).toEqual([])
  })
})

describe('tokens de diseno en un unico archivo', () => {
  it('ningun css fuera de tokens.css tiene colores literales', () => {
    const hallazgos = CSS_DE_FEATURES.flatMap((ruta) =>
      coloresLiterales(readFileSync(ruta, 'utf-8')).map((c) => `${relative(RAIZ, ruta)}: ${c}`)
    )
    expect(hallazgos).toEqual([])
  })

  it('no hay @import ni url() remotos en los css ni en index.html', () => {
    const hallazgos = archivosCss().flatMap((ruta) => recursosRemotos(readFileSync(ruta, 'utf-8')))
    expect(hallazgos).toEqual([])
    const html = readFileSync(resolve(RAIZ, '../index.html'), 'utf-8')
    expect(html).not.toMatch(/<(?:link|script|img)[^>]+(?:href|src)="(?:https?:)?\/\//i)
  })

  it('ningun selector de control quita el outline', () => {
    const hallazgos = archivosCss().flatMap((ruta) =>
      outlinesQuitados(readFileSync(ruta, 'utf-8')).map((s) => `${relative(RAIZ, ruta)}: ${s}`)
    )
    expect(hallazgos).toEqual([])
  })

  it('tokens.css define los tokens de color de ambos temas', () => {
    const tokens = readFileSync(TOKENS, 'utf-8')
    const requeridos = [
      '--color-background',
      '--color-surface',
      '--color-surface-elevated',
      '--color-text',
      '--color-text-muted',
      '--color-border',
      '--color-border-control',
      '--color-accent',
      '--color-on-accent',
      '--color-focus',
      '--color-error',
      '--color-success',
      '--color-warning',
      '--color-disabled',
      '--relleno-neutro',
      ...['fuego', 'viento', 'hielo', 'sagrado', 'electrico', 'roca', 'agua', 'planta', 'oscuro'].map(
        (e) => `--relleno-${e}`
      )
    ]
    const claro = nombresDeTokens(tokens.replace(bloqueOscuro(tokens), ''))
    const oscuro = nombresDeTokens(bloqueOscuro(tokens))
    for (const nombre of requeridos.filter((n) => !n.startsWith('--relleno'))) {
      expect(claro, `claro: ${nombre}`).toContain(nombre)
      expect(oscuro, `oscuro: ${nombre}`).toContain(nombre)
    }
    for (const nombre of requeridos.filter((n) => n.startsWith('--relleno'))) {
      expect(claro, nombre).toContain(nombre)
    }
  })

  it('tokens.css define tipografia, espaciado, radio, elevacion, movimiento y medidas', () => {
    const nombres = nombresDeTokens(readFileSync(TOKENS, 'utf-8'))
    for (const nombre of [
      '--font-family-base',
      '--font-size-body',
      '--space-md',
      '--radius-md',
      '--sombra-solida',
      '--movimiento-abanico-duracion',
      '--movimiento-abanico-curva',
      '--carta-ancho-mazo',
      '--carta-ancho-team',
      '--carta-ancho-ficha',
      '--pila-capa-1-transform',
      '--abanico-cerrado-desplazamiento',
      '--abanico-n5-p1-transform',
      '--barra-lateral-ancho'
    ]) {
      expect(nombres, nombre).toContain(nombre)
    }
  })

  it('el tema oscuro redefine colores y no toca tipografia, espaciado ni radio', () => {
    const tokens = readFileSync(TOKENS, 'utf-8')
    const oscuro = nombresDeTokens(bloqueOscuro(tokens))
    expect(oscuro).toContain('--color-background')
    expect(oscuro.filter((n) => /^--(?:font|space|radius)/.test(n))).toEqual([])
    expect(tokens).toMatch(/color-scheme:\s*light dark/)
  })

  it('ningun tamano de fuente baja de 0.875rem', () => {
    const tokens = readFileSync(TOKENS, 'utf-8')
    const tamanos = [...tokens.matchAll(/--font-size-[a-z-]+\s*:\s*([^;]+);/g)].map((m) => m[1] ?? '')
    expect(tamanos.length).toBeGreaterThan(0)
    for (const valor of tamanos) {
      expect(valor.trim()).toMatch(/rem$/)
      expect(parseFloat(valor)).toBeGreaterThanOrEqual(0.875)
    }
  })
})

describe('base.css', () => {
  it('define :focus-visible con el token de foco', () => {
    const base = readFileSync(BASE, 'utf-8')
    const regla = reglas(base).find(({ selector }) => selector.includes(':focus-visible'))
    expect(regla?.declaraciones).toContain('var(--color-focus)')
  })

  it('se importa despues de tokens.css en la ventana principal y en el overlay', () => {
    for (const archivo of ['App.tsx', 'features/overlay/OverlayApp.tsx']) {
      const codigo = readFileSync(join(RAIZ, archivo), 'utf-8')
      const tokens = codigo.search(/shared\/styles\/tokens\.css/)
      const base = codigo.search(/shared\/styles\/base\.css/)
      expect(tokens, `${archivo}: tokens`).toBeGreaterThan(-1)
      expect(base, `${archivo}: base`).toBeGreaterThan(tokens)
    }
  })
})

describe('movimiento reducido', () => {
  it('algun css tiene prefers-reduced-motion con transition none', () => {
    const conBloque = archivosCss().filter((ruta) => {
      const css = sinComentarios(readFileSync(ruta, 'utf-8'))
      const inicio = css.indexOf('@media (prefers-reduced-motion: reduce)')
      return inicio !== -1 && /transition\s*:\s*none/.test(css.slice(inicio))
    })
    expect(conBloque.length).toBeGreaterThan(0)
  })

  it('las duraciones de transicion fuera de tokens.css salen de variables', () => {
    const hallazgos = CSS_DE_FEATURES.flatMap((ruta) =>
      duracionesLiterales(readFileSync(ruta, 'utf-8')).map((d) => `${relative(RAIZ, ruta)}: ${d}`)
    )
    expect(hallazgos).toEqual([])
  })

  it('la duracion del abanico es de 280ms en tokens.css', () => {
    expect(readFileSync(TOKENS, 'utf-8')).toMatch(/--movimiento-abanico-duracion:\s*280ms/)
  })
})
