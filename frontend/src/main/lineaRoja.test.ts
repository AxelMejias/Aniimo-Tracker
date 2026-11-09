import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PROHIBIDAS = [
  'desktopCapturer',
  'setDisplayMediaRequestHandler',
  'globalShortcut',
  'sendInputEvent',
  'OpenProcess',
  'ReadProcessMemory',
  'WriteProcessMemory',
  'VirtualAllocEx',
  'CreateRemoteThread',
  'SetWindowsHookEx',
  'process.dlopen',
  'ffi-napi',
  'koffi'
]
const DEPENDENCIAS_PROHIBIDAS = [
  'ffi-napi',
  'ref-napi',
  'koffi',
  'memoryjs',
  'robotjs',
  'iohook',
  'ps-list',
  'node-window-manager',
  'active-win',
  'get-windows',
  '@nut-tree/'
]
const ARGUMENTOS_PROHIBIDOS_DE_TASKLIST = ['/V', '/M', '/SVC', '/APPS', '/S', '/U', '/P']
const RAIZ = resolve(__dirname, '..')
const PROCESO_LOCAL = resolve(RAIZ, 'main', 'arranqueLocal', 'procesoLocal.ts')
const LISTA_DE_PROCESOS = resolve(RAIZ, 'main', 'deteccionJuego', 'listaDeProcesos.ts')
const CON_PROCESOS = [PROCESO_LOCAL, LISTA_DE_PROCESOS]
const ESTE_ARCHIVO = resolve(__filename)

function archivosTs(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name)
    if (entrada.isDirectory()) {
      return archivosTs(ruta)
    }
    return ruta.endsWith('.ts') && resolve(ruta) !== ESTE_ARCHIVO ? [ruta] : []
  })
}

function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('linea roja anti-cheat', () => {
  const archivos = [...archivosTs(join(RAIZ, 'main')), ...archivosTs(join(RAIZ, 'preload'))]

  it('recorre los archivos del main y del preload', () => {
    expect(archivos.length).toBeGreaterThan(20)
    expect(archivos.some((ruta) => ruta.endsWith('index.ts'))).toBe(true)
  })

  it.each(PROHIBIDAS)('ningun archivo contiene %s', (nombre) => {
    const infractores = archivos.filter((ruta) => readFileSync(ruta, 'utf8').includes(nombre))
    expect(infractores).toEqual([])
  })

  it('ningun archivo importa un modulo nativo .node', () => {
    const infractores = archivos.filter((ruta) =>
      /(from|require\()\s*['"][^'"]*\.node['"]/.test(readFileSync(ruta, 'utf8'))
    )
    expect(infractores).toEqual([])
  })

  it('child_process aparece solo en procesoLocal.ts y listaDeProcesos.ts', () => {
    const infractores = archivos.filter(
      (ruta) =>
        readFileSync(ruta, 'utf8').includes('child_process') && !CON_PROCESOS.includes(resolve(ruta))
    )
    expect(infractores).toEqual([])
    for (const permitido of CON_PROCESOS) {
      expect(readFileSync(permitido, 'utf8')).toContain('child_process')
    }
  })

  it('procesoLocal.ts no usa shell ni exec', () => {
    const texto = readFileSync(PROCESO_LOCAL, 'utf8')
    expect(texto).not.toMatch(/shell:\s*true/)
    expect(texto).not.toMatch(/(^|[^A-Za-z])exec\(/)
    expect(texto).not.toMatch(/execSync\(/)
    expect(texto).not.toMatch(/spawnSync\(/)
  })
})

describe('linea roja de la deteccion del juego', () => {
  const texto = sinComentarios(readFileSync(LISTA_DE_PROCESOS, 'utf8'))

  it('listaDeProcesos.ts solo nombra tasklist.exe y usa execFile', () => {
    expect(texto).toContain('tasklist.exe')
    expect(texto).toMatch(/execFile/)
    const ejecutables = texto.match(/[A-Za-z0-9_-]+\.exe\b/gi) ?? []
    expect(ejecutables.every((nombre) => nombre.toLowerCase() === 'tasklist.exe')).toBe(true)
  })

  it('listaDeProcesos.ts no usa shell, exec ni spawn', () => {
    expect(texto).not.toMatch(/shell:\s*true/)
    expect(texto).not.toMatch(/(^|[^A-Za-z])exec\(/)
    expect(texto).not.toMatch(/execSync\(/)
    expect(texto).not.toMatch(/spawn(Sync)?\(/)
  })

  it.each(ARGUMENTOS_PROHIBIDOS_DE_TASKLIST)('listaDeProcesos.ts no pasa el argumento %s', (argumento) => {
    expect(texto).not.toContain(`'${argumento}'`)
    expect(texto).not.toContain(`"${argumento}"`)
    expect(texto).not.toMatch(new RegExp(`'${argumento}[ =]`, 'i'))
  })

  it('package.json no depende de ninguna libreria prohibida', () => {
    const paquete = JSON.parse(readFileSync(resolve(RAIZ, '..', 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const declaradas = [
      ...Object.keys(paquete.dependencies ?? {}),
      ...Object.keys(paquete.devDependencies ?? {})
    ]
    const infractoras = declaradas.filter((nombre) =>
      DEPENDENCIAS_PROHIBIDAS.some((prohibida) =>
        prohibida.endsWith('/') ? nombre.startsWith(prohibida) : nombre === prohibida
      )
    )
    expect(infractoras).toEqual([])
  })
})
