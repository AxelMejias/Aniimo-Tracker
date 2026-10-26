import type { HTMLAttributes, ReactElement, ReactNode } from 'react'

interface SeccionDeGrupoProps {
  readonly id: string
  readonly nombre: string
  readonly cantidad?: string
  readonly acciones?: ReactNode
  readonly mensaje?: string | null
  readonly esDestino?: boolean
  readonly propsDeLaSeccion?: HTMLAttributes<HTMLElement>
  readonly propsDelEncabezado?: HTMLAttributes<HTMLElement>
  readonly children: ReactNode
}

export default function SeccionDeGrupo({
  id,
  nombre,
  cantidad,
  acciones,
  mensaje = null,
  esDestino = false,
  propsDeLaSeccion,
  propsDelEncabezado,
  children
}: SeccionDeGrupoProps): ReactElement {
  const idDelTitulo = `seccion-${id}`
  const clase = esDestino ? 'seccion-de-grupo seccion-de-grupo--destino' : 'seccion-de-grupo'
  return (
    <section className={clase} aria-labelledby={idDelTitulo} {...propsDeLaSeccion}>
      <header className="seccion-de-grupo__encabezado" {...propsDelEncabezado}>
        <h3 className="seccion-de-grupo__nombre" id={idDelTitulo}>
          {nombre}
        </h3>
        {cantidad !== undefined && <span className="seccion-de-grupo__cantidad">{cantidad}</span>}
        {acciones}
      </header>
      {mensaje !== null && (
        <p className="seccion-de-grupo__mensaje" role="alert">
          {mensaje}
        </p>
      )}
      <div className="seccion-de-grupo__teams">{children}</div>
    </section>
  )
}
