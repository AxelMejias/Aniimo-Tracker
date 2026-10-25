import type { ReactElement, ReactNode } from 'react'
import type {
  CupoDeDespertar,
  NotaDeObjetoDePotencial,
  Potencial,
  PotencialEfectivo,
  SlotDePersonalidad
} from '../../../../shared/calculo'
import { STATS } from '../../../../shared/catalogos'
import { CampoDeSeleccion } from '../aniimo/Campos'
import type { FormularioDeFicha } from '../aniimo/formulario'
import { aplicarCupo, etiquetaDeViaDespertar, textoDeConfianza } from './potencial'
import type { CatalogoCompartido } from './useCatalogo'
import { usePotencial } from './usePotencial'
import './calculo.css'

interface PropsDelPanel {
  readonly formulario: FormularioDeFicha
  readonly deshabilitado: boolean
  readonly catalogo: CatalogoCompartido
  readonly alCambiar: (siguiente: FormularioDeFicha) => void
  readonly alSesionVencida: () => void
}

const SIN_DATOS = 'sin datos'

function coma(numero: number): string {
  return String(numero).replace('.', ',')
}

function conSigno(numero: number): string {
  return numero > 0 ? `+${numero}` : String(numero)
}

function textoDeNotaDeObjeto(nota: NotaDeObjetoDePotencial | null): string {
  switch (nota) {
    case 'sin-elegir':
      return 'no elegiste un objeto del catálogo'
    case 'objeto-desconocido':
      return 'no está en el catálogo'
    case 'sin-bono-de-potencial':
    case null:
      return 'no tiene bono de potencial para su nivel'
  }
}

function Region({
  titulo,
  children
}: {
  readonly titulo: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <section className="potencial__bloque" aria-label={titulo}>
      <h4 className="potencial__titulo">{titulo}</h4>
      {children}
    </section>
  )
}

function BloqueDePotencial({ potencial }: { readonly potencial: PotencialEfectivo | null }): ReactElement {
  return (
    <Region titulo="Potencial efectivo">
      {potencial === null ? (
        <p className="derivado">{SIN_DATOS}</p>
      ) : (
        <>
          <p className="derivado">
            {`≈ +${coma(potencial.porPunto)}% por punto, +${coma(potencial.saltoPorcentaje)}% cada ${potencial.saltoCada} (${textoDeConfianza(potencial.confianza)})`}
          </p>
          <p className="derivado">
            {`La estrella ${potencial.cuentaEstrella ? 'cuenta' : 'no cuenta'} para los saltos; el objeto ${potencial.cuentaObjeto ? 'cuenta' : 'no cuenta'}.`}
          </p>
          <table className="sugerencia__tabla" aria-label="Potencial efectivo por stat">
            <thead>
              <tr>
                <th scope="col">Stat</th>
                <th scope="col">Cargado</th>
                <th scope="col">Estrella</th>
                <th scope="col">Objeto</th>
                <th scope="col">N</th>
                <th scope="col">Saltos</th>
                <th scope="col">Próximo salto</th>
                <th scope="col">Faltan</th>
                <th scope="col">Con Despertar</th>
              </tr>
            </thead>
            <tbody>
              {STATS.map(({ codigo, etiqueta }) => {
                const stat = potencial.stats[codigo]
                return (
                  <tr key={codigo}>
                    <th scope="row">{etiqueta}</th>
                    <td>{stat.potencial}</td>
                    <td>{stat.bonoEstrella}</td>
                    <td>{stat.bonoObjeto}</td>
                    <td>{stat.n}</td>
                    <td>{stat.saltos}</td>
                    <td>{stat.proximoSalto}</td>
                    <td>{stat.puntosAlProximo}</td>
                    <td>{etiquetaDeViaDespertar(stat.viaDespertar)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </Region>
  )
}

function BloqueDeCupo({
  cupo,
  deshabilitado,
  alUsar
}: {
  readonly cupo: CupoDeDespertar | null
  readonly deshabilitado: boolean
  readonly alUsar: (cupo: number) => void
}): ReactElement {
  return (
    <Region titulo="Cupo de Despertar">
      {cupo === null ? (
        <p className="derivado">{SIN_DATOS}</p>
      ) : (
        <>
          <p className="derivado">{`Cupo sugerido: ${cupo.cupoSugerido}`}</p>
          <p className="derivado">{`Total cargado: ${cupo.totalCargado}`}</p>
          <p className="derivado">{`Diferencia: ${conSigno(cupo.diferencia)}`}</p>
          <p className="derivado">{`Restantes: ${cupo.restantes} (${textoDeConfianza(cupo.confianza)})`}</p>
          <ul className="sugerencia__desglose">
            {cupo.desglose.map((tramo, indice) => (
              <li key={indice}>{`${tramo.detalle}: +${tramo.suma}`}</li>
            ))}
          </ul>
          <button
            type="button"
            aria-label="Usar cupo sugerido"
            disabled={deshabilitado}
            onClick={() => alUsar(cupo.cupoSugerido)}
          >
            Usar
          </button>
        </>
      )}
    </Region>
  )
}

function textoDeBono(bono: SlotDePersonalidad['bonos'][number]): string {
  const nombre =
    bono.stat === null
      ? bono.descripcion
      : (STATS.find((stat) => stat.codigo === bono.stat)?.etiqueta ?? bono.descripcion)
  return `${nombre} ${conSigno(bono.porcentaje)}%`
}

function BloqueDePersonalidad({
  slots,
  sinPersonalidad
}: {
  readonly slots: readonly SlotDePersonalidad[] | null
  readonly sinPersonalidad: boolean
}): ReactElement {
  return (
    <Region titulo="Personalidad">
      {slots === null ? (
        <p className="derivado">{sinPersonalidad ? SIN_DATOS : 'Sin personalidad cargada'}</p>
      ) : (
        <ul className="potencial__personalidad">
          {slots.map((slot) =>
            slot.nombre === null ? (
              <li key={slot.letra}>{`${slot.letra}: ${SIN_DATOS}`}</li>
            ) : (
              <li key={slot.letra} className="potencial__letra">
                <strong>{`${slot.nombre} (${slot.letra})`}</strong>
                {slot.bonos.map((bono, indice) => (
                  <span key={indice}>{textoDeBono(bono)}</span>
                ))}
                {!slot.letraConfirmada && <em>letra inferida</em>}
              </li>
            )
          )}
        </ul>
      )}
    </Region>
  )
}

function Resultado({
  potencial,
  desactualizado,
  deshabilitado,
  alUsarElCupo
}: {
  readonly potencial: Potencial
  readonly desactualizado: boolean
  readonly deshabilitado: boolean
  readonly alUsarElCupo: (cupo: number) => void
}): ReactElement {
  return (
    <>
      {desactualizado && (
        <p className="sugerencia__aviso" role="status">
          El resultado está desactualizado: volvé a calcular.
        </p>
      )}
      {potencial.versionDesconocida && (
        <p className="sugerencia__aviso" role="status">
          Parche del juego desconocido
        </p>
      )}
      {potencial.avisos.map((aviso) => (
        <p className="sugerencia__aviso" role="status" key={aviso.fecha}>
          {`Datos anteriores a: ${aviso.fecha} ${aviso.descripcion}`}
        </p>
      ))}
      <BloqueDePotencial potencial={potencial.potencial} />
      <BloqueDeCupo cupo={potencial.despertar} deshabilitado={deshabilitado} alUsar={alUsarElCupo} />
      <BloqueDePersonalidad
        slots={potencial.personalidad}
        sinPersonalidad={potencial.sinDatos.includes('personalidad')}
      />
      {potencial.objeto !== null && !potencial.objeto.aplicado && (
        <p className="derivado">
          {`El objeto equipado no suma potencial: ${textoDeNotaDeObjeto(potencial.objeto.nota)}.`}
        </p>
      )}
    </>
  )
}

export default function PanelDePotencial({
  formulario,
  deshabilitado,
  catalogo,
  alCambiar,
  alSesionVencida
}: PropsDelPanel): ReactElement {
  const estado = usePotencial(formulario, alSesionVencida, catalogo)
  const { estado: estadoDelCatalogo } = catalogo
  return (
    <section className="sugerencia">
      <button
        type="button"
        className="sugerencia__alternar"
        aria-expanded={estado.abierta}
        onClick={estado.alternarApertura}
      >
        Potencial y Despertar
      </button>
      {estado.abierta && estadoDelCatalogo.tipo === 'cargando' && (
        <p className="derivado">Cargando catálogo…</p>
      )}
      {estado.abierta && estadoDelCatalogo.tipo === 'error' && (
        <p className="campo__error" role="alert">
          {estadoDelCatalogo.mensaje}
        </p>
      )}
      {estado.abierta && estadoDelCatalogo.tipo === 'listo' && (
        <div className="sugerencia__cuerpo">
          <p className="derivado">{`Parche del catálogo: ${estadoDelCatalogo.catalogo.fechaParche}`}</p>
          {estado.tieneObjetoEquipado && (
            <CampoDeSeleccion
              etiqueta="Objeto equipado del catálogo"
              valor={estado.objetoElegido}
              opciones={estadoDelCatalogo.catalogo.objetos.map((o) => ({
                codigo: o.id,
                etiqueta: o.nombre
              }))}
              opcional
              deshabilitado={deshabilitado}
              alCambiar={estado.elegirObjeto}
            />
          )}
          <div className="sugerencia__acciones">
            <button
              type="button"
              disabled={deshabilitado || estado.pendiente || !estado.entrada.ok}
              onClick={() => void estado.calcular()}
            >
              Calcular potencial
            </button>
            {!estado.entrada.ok && <p className="derivado">{estado.entrada.motivo}</p>}
          </div>
          {estado.mensaje !== null && (
            <p className="campo__error" role="alert">
              {estado.mensaje}
            </p>
          )}
          {estado.calculo !== null && (
            <Resultado
              potencial={estado.calculo.potencial}
              desactualizado={estado.desactualizado}
              deshabilitado={deshabilitado}
              alUsarElCupo={(cupo) => alCambiar(aplicarCupo(formulario, cupo))}
            />
          )}
        </div>
      )}
    </section>
  )
}
