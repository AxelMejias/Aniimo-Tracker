import type { ChangeEvent, ReactElement } from 'react'

interface ImagenDelAniimoProps {
  readonly src: string | null
  readonly mensaje: string | null
  readonly deshabilitado: boolean
  readonly alElegir: (archivo: File) => void
  readonly alQuitar: () => void
}

export default function ImagenDelAniimo({
  src,
  mensaje,
  deshabilitado,
  alElegir,
  alQuitar
}: ImagenDelAniimoProps): ReactElement {
  function alCambiarArchivo(evento: ChangeEvent<HTMLInputElement>): void {
    const archivo = evento.target.files?.[0]
    if (archivo !== undefined) {
      alElegir(archivo)
    }
    evento.target.value = ''
  }

  return (
    <div className="imagen-del-aniimo">
      {src === null ? (
        <p className="imagen-del-aniimo__ayuda">Pegá una imagen (Ctrl+V) o elegí un archivo</p>
      ) : (
        <img className="imagen-del-aniimo__vista" src={src} alt="Vista previa del Aniimo" />
      )}
      <div className="imagen-del-aniimo__acciones">
        <label className="imagen-del-aniimo__elegir">
          Elegir imagen
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={deshabilitado}
            onChange={alCambiarArchivo}
          />
        </label>
        {src !== null && (
          <button type="button" disabled={deshabilitado} onClick={alQuitar}>
            Quitar imagen
          </button>
        )}
      </div>
      {mensaje !== null && (
        <p className="campo__error" role="alert">
          {mensaje}
        </p>
      )}
    </div>
  )
}
