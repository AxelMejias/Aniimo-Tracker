import type { ReactElement } from 'react'
import type { Sugerencia, SugerenciaDeValor } from '../../../../shared/calculo'
import { POSICIONES_DE_OBJETO, STATS } from '../../../../shared/catalogos'
import { CampoDeCasilla, CampoDeSeleccion } from '../aniimo/Campos'
import type { FormularioDeFicha } from '../aniimo/formulario'
import {
  MENSAJE_DESACTUALIZADA,
  TEXTO_DE_ESTIMACION_SIN_VERIFICAR,
  notaDeObjetoNoAplicado,
  TEXTO_DE_DATOS_DE_EJEMPLO,
  textoDeDiferencia,
  textoDeMotivo,
  textoDeTermino
} from './mensajes'
import {
  aplicarSugerencia,
  aplicarTodas,
  diferencia,
  valorMostrado,
  type CampoSugerible
} from './sugerencia'
import type { CatalogoCompartido } from './useCatalogo'
import { useCalculo, type EstadoDeCalculo } from './useCalculo'
import './calculo.css'

interface PropsDelPanel {
  readonly formulario: FormularioDeFicha
  readonly deshabilitado: boolean
  readonly catalogo: CatalogoCompartido
  readonly alCambiar: (siguiente: FormularioDeFicha) => void
  readonly alSesionVencida: () => void
}

interface PropsDeFila {
  readonly etiqueta: string
  readonly cargado: string
  readonly sugerido: SugerenciaDeValor
  readonly incluirObjetos: boolean
  readonly deshabilitado: boolean
  readonly alUsar: () => void
}

function FilaDeSugerencia({
  etiqueta,
  cargado,
  sugerido,
  incluirObjetos,
  deshabilitado,
  alUsar
}: PropsDeFila): ReactElement {
  const valor = valorMostrado(sugerido, incluirObjetos)
  const terminos = sugerido.desglose.filter((t) => incluirObjetos || t.origen !== 'objeto')
  return (
    <tr>
      <th scope="row">{etiqueta}</th>
      <td>{cargado}</td>
      <td>
        {valor === null
          ? textoDeMotivo(sugerido.motivo)
          : `${valor}${sugerido.aproximado ? ' aprox.' : ''}`}
      </td>
      <td>{textoDeDiferencia(diferencia(cargado, valor))}</td>
      <td>
        {terminos.length > 0 && (
          <details>
            <summary>Desglose</summary>
            <ul className="sugerencia__desglose">
              {terminos.map((termino, indice) => (
                <li key={indice}>{textoDeTermino(termino)}</li>
              ))}
            </ul>
          </details>
        )}
      </td>
      <td>
        <button
          type="button"
          aria-label={`Usar ${etiqueta}`}
          disabled={deshabilitado || valor === null}
          onClick={alUsar}
        >
          Usar
        </button>
      </td>
    </tr>
  )
}

interface PropsDeResultado {
  readonly formulario: FormularioDeFicha
  readonly sugerencia: Sugerencia
  readonly estado: EstadoDeCalculo
  readonly deshabilitado: boolean
  readonly alCambiar: (siguiente: FormularioDeFicha) => void
}

function Resultado({
  formulario,
  sugerencia,
  estado,
  deshabilitado,
  alCambiar
}: PropsDeResultado): ReactElement {
  const { incluirObjetos } = estado
  const usar = (campo: CampoSugerible, sugerido: SugerenciaDeValor): void => {
    const valor = valorMostrado(sugerido, incluirObjetos)
    if (valor !== null) {
      alCambiar(aplicarSugerencia(formulario, campo, valor))
    }
  }
  return (
    <>
      {estado.desactualizada && (
        <p className="sugerencia__aviso" role="status">
          {MENSAJE_DESACTUALIZADA}
        </p>
      )}
      <table className="sugerencia__tabla">
        <thead>
          <tr>
            <th scope="col">Stat</th>
            <th scope="col">Cargado</th>
            <th scope="col">Sugerido</th>
            <th scope="col">Diferencia</th>
            <th scope="col">Detalle</th>
            <th scope="col">Acción</th>
          </tr>
        </thead>
        <tbody>
          {STATS.map(({ codigo, etiqueta }) => (
            <FilaDeSugerencia
              key={codigo}
              etiqueta={etiqueta}
              cargado={formulario.stats[codigo].valorActual}
              sugerido={sugerencia.stats[codigo]}
              incluirObjetos={incluirObjetos}
              deshabilitado={deshabilitado}
              alUsar={() => usar(codigo, sugerencia.stats[codigo])}
            />
          ))}
          <FilaDeSugerencia
            etiqueta="CP"
            cargado={formulario.cp}
            sugerido={sugerencia.cp}
            incluirObjetos={incluirObjetos}
            deshabilitado={deshabilitado}
            alUsar={() => usar('cp', sugerencia.cp)}
          />
        </tbody>
      </table>
      <div className="sugerencia__acciones">
        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => alCambiar(aplicarTodas(formulario, sugerencia, incluirObjetos))}
        >
          Usar todas
        </button>
      </div>
      {sugerencia.objetos
        .filter((objeto) => !objeto.aplicado)
        .map((objeto) => (
          <p className="derivado" key={objeto.posicion}>
            {notaDeObjetoNoAplicado(objeto.posicion, objeto.nota)}
          </p>
        ))}
    </>
  )
}

export default function PanelDeSugerencia({
  formulario,
  deshabilitado,
  catalogo: compartido,
  alCambiar,
  alSesionVencida
}: PropsDelPanel): ReactElement {
  const estado = useCalculo(formulario, alSesionVencida, compartido)
  const { catalogo } = estado
  const sinDatos =
    estado.calculo?.sugerencia.sinDatos ?? (catalogo.tipo === 'listo' ? catalogo.catalogo.sinDatos : [])
  return (
    <section className="sugerencia">
      <button
        type="button"
        className="sugerencia__alternar"
        aria-expanded={estado.abierta}
        onClick={estado.alternarApertura}
      >
        Sugerencia de stats
      </button>
      {estado.abierta && catalogo.tipo === 'cargando' && (
        <p className="derivado">Cargando catálogo…</p>
      )}
      {estado.abierta && catalogo.tipo === 'error' && (
        <p className="campo__error" role="alert">
          {catalogo.mensaje}
        </p>
      )}
      {estado.abierta && catalogo.tipo === 'listo' && (
        <div className="sugerencia__cuerpo">
          {catalogo.catalogo.esEjemplo && (
            <p className="sugerencia__ejemplo" role="note">
              {TEXTO_DE_DATOS_DE_EJEMPLO}
            </p>
          )}
          {!catalogo.catalogo.estimacionVerificada && (
            <p className="sugerencia__ejemplo" role="note">
              {TEXTO_DE_ESTIMACION_SIN_VERIFICAR}
            </p>
          )}
          <div className="sugerencia__selectores">
            <CampoDeSeleccion
              etiqueta="Especie del catálogo"
              valor={estado.especieId}
              opciones={catalogo.catalogo.especies.map((e) => ({ codigo: e.id, etiqueta: e.nombre }))}
              opcional
              deshabilitado={deshabilitado}
              alCambiar={estado.elegirEspecie}
            />
            {estado.objetosCargados.map(({ posicion, elegido }) => (
              <CampoDeSeleccion
                key={posicion}
                etiqueta={`Objeto ${
                  POSICIONES_DE_OBJETO.find((p) => p.codigo === posicion)?.etiqueta.toLowerCase() ??
                  posicion
                } del catálogo`}
                valor={elegido}
                opciones={catalogo.catalogo.objetos.map((o) => ({ codigo: o.id, etiqueta: o.nombre }))}
                opcional
                deshabilitado={deshabilitado}
                alCambiar={(id) => estado.elegirObjeto(posicion, id)}
              />
            ))}
          </div>
          <CampoDeCasilla
            etiqueta="Incluir objetos"
            marcado={estado.incluirObjetos}
            deshabilitado={deshabilitado}
            alCambiar={estado.cambiarIncluirObjetos}
          />
          <div className="sugerencia__acciones">
            <button
              type="button"
              disabled={deshabilitado || estado.pendiente || !estado.entrada.ok}
              onClick={() => void estado.calcular()}
            >
              Calcular
            </button>
            {!estado.entrada.ok && <p className="derivado">{estado.entrada.motivo}</p>}
          </div>
          {estado.mensaje !== null && (
            <p className="campo__error" role="alert">
              {estado.mensaje}
            </p>
          )}
          {sinDatos.length > 0 && <p className="derivado">No incluye: {sinDatos.join(', ')}</p>}
          {estado.calculo !== null && (
            <Resultado
              formulario={formulario}
              sugerencia={estado.calculo.sugerencia}
              estado={estado}
              deshabilitado={deshabilitado}
              alCambiar={alCambiar}
            />
          )}
        </div>
      )}
    </section>
  )
}
