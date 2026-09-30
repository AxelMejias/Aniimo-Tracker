import {
  LADO_MAXIMO_DE_IMAGEN,
  TAMANO_MAXIMO_DE_IMAGEN,
  TIPOS_DE_IMAGEN
} from '../../../../shared/teams'

const CALIDAD_WEBP = 0.85

export interface ImagenRecodificada {
  readonly tipo: 'image/webp'
  readonly datos: Uint8Array
}

export type Recodificador = (archivo: File) => Promise<ImagenRecodificada>

export function esTipoDeImagenPermitido(tipo: string): boolean {
  return (TIPOS_DE_IMAGEN as readonly string[]).includes(tipo)
}

function convertirEnBlob(lienzo: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolver) => lienzo.toBlob(resolver, 'image/webp', CALIDAD_WEBP))
}

// Redibujar en un lienzo descarta los metadatos (EXIF) de la imagen original.
export const recodificarImagen: Recodificador = async (archivo) => {
  const mapa = await createImageBitmap(archivo)
  try {
    const escala = Math.min(1, LADO_MAXIMO_DE_IMAGEN / Math.max(mapa.width, mapa.height))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.max(1, Math.round(mapa.width * escala))
    lienzo.height = Math.max(1, Math.round(mapa.height * escala))
    const contexto = lienzo.getContext('2d')
    if (contexto === null) {
      throw new Error('Lienzo no disponible')
    }
    contexto.drawImage(mapa, 0, 0, lienzo.width, lienzo.height)
    const blob = await convertirEnBlob(lienzo)
    if (blob === null || blob.type !== 'image/webp' || blob.size > TAMANO_MAXIMO_DE_IMAGEN) {
      throw new Error('No se pudo exportar la imagen')
    }
    return { tipo: 'image/webp', datos: new Uint8Array(await blob.arrayBuffer()) }
  } finally {
    mapa.close()
  }
}

// La CSP solo permite data: en img-src, por eso la vista previa no usa URL de blob.
export function aDataUrl(imagen: ImagenRecodificada): string {
  let binario = ''
  const trozo = 0x8000
  for (let inicio = 0; inicio < imagen.datos.length; inicio += trozo) {
    binario += String.fromCharCode(...imagen.datos.subarray(inicio, inicio + trozo))
  }
  return `data:${imagen.tipo};base64,${btoa(binario)}`
}
