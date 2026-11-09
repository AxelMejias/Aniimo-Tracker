import { describe, expect, it } from 'vitest'
import { prepararConfiguracion, type SistemaDeArchivos } from './configuracion'
import { rutasDeArranque } from './rutas'

const rutas = rutasDeArranque(String.raw`C:\Datos\Aniimo`, String.raw`C:\Programa\resources`)

function sistemaFalso(inicial: Record<string, string> = {}) {
  const archivos = new Map(Object.entries(inicial))
  const carpetas: string[] = []
  const escrituras: string[] = []
  const sistema: SistemaDeArchivos = {
    existe: (ruta) => archivos.has(ruta),
    crearCarpeta: (ruta) => {
      carpetas.push(ruta)
    },
    escribirNuevo: (ruta, contenido) => {
      if (archivos.has(ruta)) {
        throw new Error(`EEXIST ${ruta}`)
      }
      archivos.set(ruta, contenido)
      escrituras.push(ruta)
    }
  }
  return { sistema, archivos, carpetas, escrituras }
}

function aleatorioFijo(byte: number) {
  return (cantidad: number) => Buffer.alloc(cantidad, byte)
}

function valor(texto: string | undefined, clave: string): string | undefined {
  return texto
    ?.split('\n')
    .find((linea) => linea.startsWith(`${clave}=`))
    ?.slice(clave.length + 1)
}

describe('prepararConfiguracion', () => {
  it('con la carpeta vacia crea los dos archivos con la misma contrasena', () => {
    const { sistema, archivos, carpetas } = sistemaFalso()
    const resultado = prepararConfiguracion(rutas, sistema, aleatorioFijo(1))
    expect(resultado).toBe('creada')
    expect(carpetas).toContain(rutas.carpetaDelBackend)
    const compose = archivos.get(rutas.composeEnv)
    const backend = archivos.get(rutas.backendEnv)
    const contrasena = valor(compose, 'POSTGRES_PASSWORD')
    expect(contrasena).toBe(Buffer.alloc(32, 1).toString('base64url'))
    expect(valor(compose, 'POSTGRES_USER')).toBe('aniimo')
    expect(valor(compose, 'POSTGRES_DB')).toBe('aniimo')
    expect(valor(backend, 'DATABASE_URL')).toBe(
      `postgresql+psycopg://aniimo:${contrasena}@127.0.0.1:5436/aniimo`
    )
    expect(valor(backend, 'BACKEND_PORT')).toBe('8001')
    expect(valor(backend, 'LOG_LEVEL')).toBe('INFO')
  })

  it('pide 32 bytes al generador', () => {
    const pedidos: number[] = []
    prepararConfiguracion(rutas, sistemaFalso().sistema, (cantidad) => {
      pedidos.push(cantidad)
      return Buffer.alloc(cantidad, 7)
    })
    expect(pedidos).toEqual([32])
  })

  it('dos generaciones dan contrasenas distintas', () => {
    const a = sistemaFalso()
    const b = sistemaFalso()
    prepararConfiguracion(rutas, a.sistema, aleatorioFijo(1))
    prepararConfiguracion(rutas, b.sistema, aleatorioFijo(2))
    expect(valor(a.archivos.get(rutas.composeEnv), 'POSTGRES_PASSWORD')).not.toBe(
      valor(b.archivos.get(rutas.composeEnv), 'POSTGRES_PASSWORD')
    )
  })

  it('si existen los dos devuelve existente sin escribir', () => {
    const { sistema, escrituras, carpetas } = sistemaFalso({
      [rutas.composeEnv]: 'x',
      [rutas.backendEnv]: 'y'
    })
    expect(prepararConfiguracion(rutas, sistema, aleatorioFijo(1))).toBe('existente')
    expect(escrituras).toEqual([])
    expect(carpetas).toEqual([])
  })

  it.each([[{ composeEnv: 'x' }], [{ backendEnv: 'y' }]])(
    'si existe solo uno devuelve incompleta sin escribir (%j)',
    (parcial) => {
      const inicial: Record<string, string> = {}
      if ('composeEnv' in parcial) {
        inicial[rutas.composeEnv] = 'x'
      }
      if ('backendEnv' in parcial) {
        inicial[rutas.backendEnv] = 'y'
      }
      const { sistema, escrituras } = sistemaFalso(inicial)
      expect(prepararConfiguracion(rutas, sistema, aleatorioFijo(1))).toBe('incompleta')
      expect(escrituras).toEqual([])
    }
  )

  it('el resultado y los errores no contienen la contrasena', () => {
    const contrasena = Buffer.alloc(32, 9).toString('base64url')
    const { sistema } = sistemaFalso({ [rutas.composeEnv]: 'x' })
    const resultado = prepararConfiguracion(rutas, sistema, aleatorioFijo(9))
    expect(resultado).not.toContain(contrasena)

    const choque = sistemaFalso()
    const original = choque.sistema.escribirNuevo
    let llamadas = 0
    const conChoque: SistemaDeArchivos = {
      ...choque.sistema,
      escribirNuevo: (ruta, contenido) => {
        llamadas += 1
        if (llamadas === 2) {
          throw new Error('EEXIST')
        }
        original(ruta, contenido)
      }
    }
    let mensaje = ''
    try {
      prepararConfiguracion(rutas, conChoque, aleatorioFijo(9))
    } catch (error) {
      mensaje = String(error)
    }
    expect(mensaje).not.toBe('')
    expect(mensaje).not.toContain(contrasena)
  })
})
