import { randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { urlBaseDelBackend } from '../backend/peticion'
import { PUERTO_DEL_BACKEND, prepararConfiguracion } from './configuracion'
import { ejecutarDocker, lanzarBackend } from './procesoLocal'
import { abrirLog } from './registroDelBackend'
import { rutasDeArranque } from './rutas'
import { crearSecuenciaDeArranque, type SecuenciaDeArranque } from './secuenciaDeArranque'
import { backendSaludable, puertoRespondiendo } from './sondas'

export function crearSecuenciaReal(userData: string, resourcesPath: string): SecuenciaDeArranque {
  const rutas = rutasDeArranque(userData, resourcesPath)
  const urlBase = urlBaseDelBackend(true)
  return crearSecuenciaDeArranque({
    rutas,
    prepararConfiguracion: () =>
      prepararConfiguracion(
        rutas,
        {
          existe: existsSync,
          crearCarpeta: (ruta) => void mkdirSync(ruta, { recursive: true }),
          escribirNuevo: (ruta, contenido) =>
            writeFileSync(ruta, contenido, { encoding: 'utf8', flag: 'wx' })
        },
        (bytes) => randomBytes(bytes)
      ),
    ejecutarDocker: (argumentos) => ejecutarDocker(argumentos),
    puertoRespondiendo: () => puertoRespondiendo(PUERTO_DEL_BACKEND),
    abrirLog: () =>
      abrirLog(rutas, {
        crearCarpeta: (ruta) => void mkdirSync(ruta, { recursive: true }),
        existe: existsSync,
        borrar: (ruta) => rmSync(ruta, { force: true }),
        renombrar: renameSync,
        abrirParaAgregar: (ruta) => openSync(ruta, 'a'),
        cerrar: closeSync
      }),
    lanzarBackend: (opciones, argumentos) => lanzarBackend(opciones, argumentos),
    saludable: () => backendSaludable(fetch, urlBase),
    dormir: (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos)),
    ahora: () => Date.now()
  })
}
