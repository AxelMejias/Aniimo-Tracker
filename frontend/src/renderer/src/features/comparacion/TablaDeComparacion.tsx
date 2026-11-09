import type { ReactElement } from 'react'
import BarraSvg from '../../shared/components/BarraSvg'
import { largosDeFila } from './barras'
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

interface LadoDeFilaProps {
  readonly valor: number | string | null
  readonly largo: number | null
  readonly lado: 'izquierda' | 'derecha'
}

function LadoDeFila({ valor, largo, lado }: LadoDeFilaProps): ReactElement {
  const numero = <span className="comparacion__valor">{valor ?? SIN_DATO}</span>
  const barra =
    largo === null ? null : (
      <span className="comparacion__barra">
        <BarraSvg
          largo={largo}
          sentido={lado}
          lado={lado === 'izquierda' ? 'a' : 'b'}
        />
      </span>
    )
  return (
    <td className={`comparacion__lado-de-fila comparacion__lado-de-fila--${lado}`}>
      {lado === 'izquierda' ? (
        <>
          {numero}
          {barra}
        </>
      ) : (
        <>
          {barra}
          {numero}
        </>
      )}
    </td>
  )
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
          <th scope="col">{izquierda}</th>
          <th scope="col">Campo</th>
          <th scope="col">{derecha}</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => {
          const largos =
            fila.tipo === 'numero' ? largosDeFila(fila.izquierda, fila.derecha) : null
          return (
            <tr key={fila.clave}>
              <LadoDeFila valor={fila.izquierda} largo={largos?.izquierda ?? null} lado="izquierda" />
              <th scope="row" className="comparacion__centro">
                <span className="comparacion__campo">{fila.etiqueta}</span>
                {fila.tipo === 'numero' && fila.diferencia !== null && (
                  <span className="comparacion__diferencia">{diferenciaComoTexto(fila.diferencia)}</span>
                )}
                {fila.tipo === 'numero' && fila.mayor !== null && (
                  <span className="comparacion__mayor">{ETIQUETA_DE_MAYOR[fila.mayor]}</span>
                )}
              </th>
              <LadoDeFila valor={fila.derecha} largo={largos?.derecha ?? null} lado="derecha" />
            </tr>
          )
        })}
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
