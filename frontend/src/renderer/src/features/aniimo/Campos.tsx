import { useId, type ReactElement } from 'react'

interface BaseDeCampo {
  readonly etiqueta: string
  readonly error?: string | undefined
  readonly deshabilitado?: boolean
}

function MensajeDeCampo({ id, mensaje }: { readonly id: string; readonly mensaje: string }): ReactElement {
  return (
    <p className="campo__error" id={id} role="alert">
      {mensaje}
    </p>
  )
}

interface CampoDeTextoProps extends BaseDeCampo {
  readonly valor: string
  readonly alCambiar: (valor: string) => void
  readonly numerico?: boolean
}

export function CampoDeTexto({
  etiqueta,
  valor,
  alCambiar,
  error,
  deshabilitado,
  numerico
}: CampoDeTextoProps): ReactElement {
  const id = useId()
  const idError = `${id}-error`
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        className="campo__control"
        id={id}
        type="text"
        inputMode={numerico === true ? 'numeric' : undefined}
        value={valor}
        disabled={deshabilitado}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : idError}
        onChange={(evento) => alCambiar(evento.target.value)}
      />
      {error !== undefined && <MensajeDeCampo id={idError} mensaje={error} />}
    </div>
  )
}

interface CampoDeAreaProps extends BaseDeCampo {
  readonly valor: string
  readonly alCambiar: (valor: string) => void
}

export function CampoDeArea({
  etiqueta,
  valor,
  alCambiar,
  error,
  deshabilitado
}: CampoDeAreaProps): ReactElement {
  const id = useId()
  const idError = `${id}-error`
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <textarea
        className="campo__control"
        id={id}
        rows={4}
        value={valor}
        disabled={deshabilitado}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : idError}
        onChange={(evento) => alCambiar(evento.target.value)}
      />
      {error !== undefined && <MensajeDeCampo id={idError} mensaje={error} />}
    </div>
  )
}

interface Opcion {
  readonly codigo: string
  readonly etiqueta: string
}

interface CampoDeSeleccionProps extends BaseDeCampo {
  readonly valor: string
  readonly opciones: readonly Opcion[]
  readonly alCambiar: (valor: string) => void
  readonly opcional?: boolean
  readonly sinElegir?: string
}

export function CampoDeSeleccion({
  etiqueta,
  valor,
  opciones,
  alCambiar,
  error,
  deshabilitado,
  opcional,
  sinElegir = 'Sin elegir'
}: CampoDeSeleccionProps): ReactElement {
  const id = useId()
  const idError = `${id}-error`
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <select
        className="campo__control"
        id={id}
        value={valor}
        disabled={deshabilitado}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : idError}
        onChange={(evento) => alCambiar(evento.target.value)}
      >
        {opcional === true && <option value="">{sinElegir}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.codigo} value={opcion.codigo}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      {error !== undefined && <MensajeDeCampo id={idError} mensaje={error} />}
    </div>
  )
}

interface CampoDeCasillaProps extends BaseDeCampo {
  readonly marcado: boolean
  readonly alCambiar: (marcado: boolean) => void
}

export function CampoDeCasilla({
  etiqueta,
  marcado,
  alCambiar,
  deshabilitado
}: CampoDeCasillaProps): ReactElement {
  const id = useId()
  return (
    <div className="campo campo--casilla">
      <input
        id={id}
        type="checkbox"
        checked={marcado}
        disabled={deshabilitado}
        onChange={(evento) => alCambiar(evento.target.checked)}
      />
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
    </div>
  )
}

interface CampoDeFechaProps extends BaseDeCampo {
  readonly valor: string
  readonly alCambiar: (valor: string) => void
  readonly ayuda?: string
}

export function CampoDeFecha({
  etiqueta,
  valor,
  alCambiar,
  error,
  deshabilitado,
  ayuda
}: CampoDeFechaProps): ReactElement {
  const id = useId()
  const idError = `${id}-error`
  const idAyuda = `${id}-ayuda`
  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        className="campo__control"
        id={id}
        type="date"
        value={valor}
        disabled={deshabilitado}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? idAyuda : `${idAyuda} ${idError}`}
        onChange={(evento) => alCambiar(evento.target.value)}
      />
      {ayuda !== undefined && (
        <p className="campo__ayuda" id={idAyuda}>
          {ayuda}
        </p>
      )}
      {error !== undefined && <MensajeDeCampo id={idError} mensaje={error} />}
    </div>
  )
}
