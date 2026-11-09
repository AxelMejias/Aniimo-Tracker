import type { ReactElement } from 'react'
import type { OpcionDeGrupo } from './secciones'

interface SelectorDeGrupoProps {
  readonly valor: string | null
  readonly opciones: readonly OpcionDeGrupo[]
  readonly deshabilitado: boolean
  readonly alCambiar: (grupoId: string | null) => void
}

export default function SelectorDeGrupo({
  valor,
  opciones,
  deshabilitado,
  alCambiar
}: SelectorDeGrupoProps): ReactElement {
  return (
    <label className="selector-de-grupo">
      Grupo
      <select
        value={valor ?? ''}
        disabled={deshabilitado}
        onChange={(e) => alCambiar(e.target.value === '' ? null : e.target.value)}
      >
        <option value="">Sin grupo</option>
        {opciones.map((grupo) => (
          <option key={grupo.id} value={grupo.id}>
            {grupo.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}
