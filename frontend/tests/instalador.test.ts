import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Configuracion = {
  productName: string
  asar: boolean
  directories: { output: string }
  files: string[]
  extraResources: { from: string; to: string }[]
  publish?: unknown
  win: { target: { target: string; arch: string[] }[] }
  nsis: {
    oneClick: boolean
    perMachine: boolean
    createDesktopShortcut: boolean
    createStartMenuShortcut: boolean
    shortcutName: string
    deleteAppDataOnUninstall: boolean
  }
  electronFuses: Record<string, boolean>
}

const raiz = resolve(__dirname, '..')
const configuracion = JSON.parse(
  readFileSync(resolve(raiz, 'electron-builder.json'), 'utf-8')
) as Configuracion
const paquete = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf-8')) as {
  version: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

describe('configuracion del instalador', () => {
  it('se llama Aniimo Team Tracker y deja el instalador en release', () => {
    expect(configuracion.productName).toBe('Aniimo Team Tracker')
    expect(configuracion.directories.output).toBe('release')
  })

  it('instala por usuario con un clic y con accesos directos', () => {
    expect(configuracion.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
    expect(configuracion.nsis.oneClick).toBe(true)
    expect(configuracion.nsis.perMachine).toBe(false)
    expect(configuracion.nsis.createDesktopShortcut).toBe(true)
    expect(configuracion.nsis.createStartMenuShortcut).toBe(true)
    expect(configuracion.nsis.shortcutName).toBe('Aniimo Team Tracker')
  })

  it('la desinstalacion conserva los datos del usuario', () => {
    expect(configuracion.nsis.deleteAppDataOnUninstall).toBe(false)
  })

  it('usa asar y los fusibles de N16', () => {
    expect(configuracion.asar).toBe(true)
    expect(configuracion.electronFuses).toEqual({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      onlyLoadAppFromAsar: true,
      enableEmbeddedAsarIntegrityValidation: true
    })
  })

  it('no publica ni se actualiza solo', () => {
    expect(configuracion.publish).toBeNull()
    const dependencias = { ...paquete.dependencies, ...paquete.devDependencies }
    expect(Object.keys(dependencias)).not.toContain('electron-updater')
    expect(JSON.stringify(configuracion)).not.toMatch(/https?:/)
  })

  it('mete el backend y el compose como recursos fuera del asar', () => {
    const destinos = configuracion.extraResources.map((recurso) => recurso.to)
    expect(destinos).toContain('aniimo-backend')
    expect(destinos).toContain('docker-compose.app.yml')
    const desde = configuracion.extraResources.map((recurso) => recurso.from)
    expect(desde).toContain('../backend/dist/aniimo-backend')
    expect(desde).toContain('../docker-compose.app.yml')
  })

  it('no empaqueta archivos .env ni tests', () => {
    const todo = JSON.stringify([...configuracion.files, ...configuracion.extraResources])
    expect(todo).not.toMatch(/\.env(?!\.example)/)
    expect(configuracion.files).toContain('out/**')
    expect(configuracion.files.some((patron) => patron.includes('src/'))).toBe(false)
  })

  it('la version sale solo de package.json', () => {
    expect(paquete.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(JSON.stringify(configuracion)).not.toContain(paquete.version)
    expect(JSON.stringify(configuracion)).not.toMatch(/"(buildVersion|version)"/)
  })
})
