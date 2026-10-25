import type { ReactElement } from 'react'
import type { FilaDeComparacion, Mayor, ParDeSlots } from './comparar'

const SIN_DATO = '—'

const ETIQUETA_DE_MAYOR: Readonly<Record<Mayor, string>> = {
  izquierda: 'Izquierda',
  derecha: 'Derecha',
  igual: 'Igual'
}

function diferenciaComoTexto(diferencia: number | null): string {
  if (diferencia === null) {
    return ''
  }
  return diferencia > 0 ? `+${diferencia}` : String(diferencia)
}

interface TablaDeComparacionProps {
  readonly izquierda: string
  readonly derecha: string
  readonly filas: readonly FilaDeComparacion[]
}

export function TablaDeComparacion({
  izquierda,
  derecha,
  filas
}: TablaDeComparacionProps): ReactElement {
  return (
    <table className="comparacion__tabla" aria-label="Comparación de Aniimo">
      <thead>
        <tr>
          <th scope="col">Campo</th>
          <th scope="col">{izquierda}</th>
          <th scope="col">{derecha}</th>
          <th scope="col">Diferencia</th>
          <th scope="col">Mayor</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.clave}>
            <th scope="row">{fila.etiqueta}</th>
            <td>{fila.izquierda ?? SIN_DATO}</td>
            <td>{fila.derecha ?? SIN_DATO}</td>
            <td>{fila.tipo === 'numero' ? diferenciaComoTexto(fila.diferencia) : ''}</td>
            <td>
              {fila.tipo === 'numero' && fila.mayor !== null ? ETIQUETA_DE_MAYOR[fila.mayor] : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface TablaDeTeamsProps {
  readonly izquierda: string
  readonly derecha: string
  readonly pares: readonly ParDeSlots[]
}

function resumenComoTexto(resumen: ParDeSlots['izquierda']): string {
  if (resumen === null) {
    return 'Vacío'
  }
  const despertar = `${resumen.despertaresUsados}/${resumen.despertaresTotal}`
  return `${resumen.nombre} · Nivel ${resumen.nivel} · CP ${resumen.cp} · Estrella ${resumen.estrellaActual} · Despertar ${despertar}`
}

export function TablaDeTeams({ izquierda, derecha, pares }: TablaDeTeamsProps): ReactElement {
  return (
    <table className="comparacion__tabla" aria-label="Comparación de teams">
      <thead>
        <tr>
          <th scope="col">Slot</th>
          <th scope="col">{izquierda}</th>
          <th scope="col">{derecha}</th>
        </tr>
      </thead>
      <tbody>
        {pares.map((par) => (
          <tr key={par.slot}>
            <th scope="row">Slot {par.slot}</th>
            <td>{resumenComoTexto(par.izquierda)}</td>
            <td>{resumenComoTexto(par.derecha)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
