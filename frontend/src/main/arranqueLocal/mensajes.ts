import type { ErrorDeArranque } from './secuenciaDeArranque'

export type MensajeDeError = { readonly titulo: string; readonly texto: string }

export function mensajeDeError(
  error: ErrorDeArranque,
  rutaDelLog: string,
  carpetaDeDatos: string
): MensajeDeError {
  switch (error) {
    case 'docker-no-encontrado':
      return {
        titulo: 'No encuentro Docker',
        texto: 'Instalá Docker Desktop y volvé a abrir Aniimo Team Tracker.'
      }
    case 'docker-detenido':
      return {
        titulo: 'Docker no está listo',
        texto: 'Abrí Docker Desktop y esperá que termine de arrancar. Después elegí Reintentar.'
      }
    case 'base-no-responde':
      return {
        titulo: 'La base de datos no responde',
        texto:
          'La base no aceptó conexiones en 30 segundos. Revisá que Docker Desktop esté funcionando y elegí Reintentar.'
      }
    case 'puerto-ocupado':
      return {
        titulo: 'El puerto 8001 está ocupado',
        texto:
          'Otro programa ya está usando el puerto 8001 de esta PC. Cerralo y elegí Reintentar; la app no lo cierra por vos.'
      }
    case 'migracion-fallida':
      return {
        titulo: 'No se pudo actualizar la base',
        texto: `Falló la migración de la base de datos. Revisá el detalle en ${rutaDelLog}.`
      }
    case 'backend-se-cerro':
      return {
        titulo: 'El backend se cerró al arrancar',
        texto: `El backend terminó antes de estar listo. Revisá el detalle en ${rutaDelLog}.`
      }
    case 'backend-no-responde':
      return {
        titulo: 'El backend no responde',
        texto: `El backend no respondió en 30 segundos. Revisá el detalle en ${rutaDelLog}.`
      }
    case 'configuracion-incompleta':
      return {
        titulo: 'Configuración incompleta',
        texto: `Falta uno de los dos archivos de configuración en ${carpetaDeDatos}. La app no crea uno nuevo porque la contraseña ya no coincidiría con la base. Mirá el README para recuperarlo.`
      }
    case 'configuracion-ilegible':
      return {
        titulo: 'No se pudo preparar la configuración',
        texto: `No pude crear los archivos de configuración en ${carpetaDeDatos}. Revisá los permisos de esa carpeta y elegí Reintentar.`
      }
  }
}
