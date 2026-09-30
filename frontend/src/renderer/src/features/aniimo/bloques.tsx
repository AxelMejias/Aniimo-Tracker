import type { ReactElement, ReactNode } from 'react'
import {
  ELEMENTOS,
  LETRAS_DE_PERSONALIDAD,
  POSICIONES_DE_OBJETO,
  POTENCIALES_INNATOS,
  RAREZAS,
  ROLES,
  STATS
} from '../../../../shared/catalogos'
import {
  CampoDeArea,
  CampoDeCasilla,
  CampoDeSeleccion,
  CampoDeTexto
} from './Campos'
import {
  contratoHabilitado,
  despertaresRestantes,
  estadoDeMaterial,
  POSICIONES_DE_OBJETO_EN_ORDEN,
  type FormularioDeFicha,
  type FormularioDeMaterial,
  type FormularioDeObjeto,
  type FormularioDeStat
} from './formulario'
import type { ErroresDeFicha } from './validacionFicha'

export interface PropsDeBloque {
  readonly formulario: FormularioDeFicha
  readonly errores: ErroresDeFicha
  readonly deshabilitado: boolean
  readonly alCambiar: (siguiente: FormularioDeFicha) => void
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }): ReactElement {
  return (
    <fieldset className="bloque">
      <legend className="bloque__titulo">{titulo}</legend>
      <div className="bloque__contenido">{children}</div>
    </fieldset>
  )
}

interface PropsDeDatosGenerales extends PropsDeBloque {
  readonly imagen: ReactNode
}

export function DatosGenerales({
  formulario,
  errores,
  deshabilitado,
  alCambiar,
  imagen
}: PropsDeDatosGenerales): ReactElement {
  const cambiar = (parcial: Partial<FormularioDeFicha>): void =>
    alCambiar({ ...formulario, ...parcial })
  return (
    <Bloque titulo="Datos generales">
      {imagen}
      <CampoDeTexto
        etiqueta="Nombre"
        valor={formulario.nombre}
        error={errores.nombre}
        deshabilitado={deshabilitado}
        alCambiar={(nombre) => cambiar({ nombre })}
      />
      <CampoDeSeleccion
        etiqueta="Elemento"
        valor={formulario.elemento}
        opciones={ELEMENTOS}
        opcional
        error={errores.elemento}
        deshabilitado={deshabilitado}
        alCambiar={(elemento) => cambiar({ elemento })}
      />
      <CampoDeSeleccion
        etiqueta="Rol"
        valor={formulario.rol}
        opciones={ROLES}
        opcional
        error={errores.rol}
        deshabilitado={deshabilitado}
        alCambiar={(rol) => cambiar({ rol })}
      />
      <CampoDeSeleccion
        etiqueta="Potencial innato"
        valor={formulario.potencialInnato}
        opciones={POTENCIALES_INNATOS}
        opcional
        error={errores.potencial_innato}
        deshabilitado={deshabilitado}
        alCambiar={(potencialInnato) => cambiar({ potencialInnato })}
      />
      <div className="personalidad">
        {LETRAS_DE_PERSONALIDAD.map((par, indice) => (
          <CampoDeSeleccion
            key={par.join('')}
            etiqueta={`Personalidad letra ${indice + 1}`}
            valor={formulario.personalidad[indice] ?? ''}
            opciones={par.map((letra) => ({ codigo: letra, etiqueta: letra }))}
            opcional
            deshabilitado={deshabilitado}
            alCambiar={(letra) => {
              const letras = [...formulario.personalidad] as [string, string, string, string]
              letras[indice] = letra
              cambiar({ personalidad: letras })
            }}
          />
        ))}
        {errores.personalidad !== undefined && (
          <p className="campo__error" role="alert">
            {errores.personalidad}
          </p>
        )}
      </div>
      <CampoDeTexto
        etiqueta="Nivel"
        numerico
        valor={formulario.nivel}
        error={errores.nivel}
        deshabilitado={deshabilitado}
        alCambiar={(nivel) => cambiar({ nivel })}
      />
      <CampoDeTexto
        etiqueta="CP"
        numerico
        valor={formulario.cp}
        error={errores.cp}
        deshabilitado={deshabilitado}
        alCambiar={(cp) => cambiar({ cp })}
      />
    </Bloque>
  )
}

export function BloqueDeStats({
  formulario,
  errores,
  deshabilitado,
  alCambiar
}: PropsDeBloque): ReactElement {
  return (
    <Bloque titulo="Stats">
      {STATS.map(({ codigo, etiqueta }) => {
        const stat = formulario.stats[codigo]
        const cambiar = (parcial: Partial<FormularioDeStat>): void =>
          alCambiar({
            ...formulario,
            stats: { ...formulario.stats, [codigo]: { ...stat, ...parcial } }
          })
        const clave = `stats.${codigo}`
        return (
          <div className="fila-de-stat" key={codigo}>
            <CampoDeTexto
              etiqueta={`${etiqueta} valor`}
              numerico
              valor={stat.valorActual}
              error={errores[`${clave}.valor_actual`]}
              deshabilitado={deshabilitado}
              alCambiar={(valorActual) => cambiar({ valorActual })}
            />
            <CampoDeTexto
              etiqueta={`${etiqueta} potencial`}
              numerico
              valor={stat.potencial}
              error={errores[`${clave}.potencial`]}
              deshabilitado={deshabilitado}
              alCambiar={(potencial) => cambiar({ potencial })}
            />
            <CampoDeTexto
              etiqueta={`${etiqueta} bono de estrellas`}
              numerico
              valor={stat.bonoEstrellasIncluido}
              error={errores[`${clave}.bono_estrellas_incluido`]}
              deshabilitado={deshabilitado}
              alCambiar={(bonoEstrellasIncluido) => cambiar({ bonoEstrellasIncluido })}
            />
            <CampoDeTexto
              etiqueta={`${etiqueta} notas`}
              valor={stat.notas}
              error={errores[`${clave}.notas`]}
              deshabilitado={deshabilitado}
              alCambiar={(notas) => cambiar({ notas })}
            />
          </div>
        )
      })}
    </Bloque>
  )
}

function textoDeEstado(material: FormularioDeMaterial): string | null {
  const estado = estadoDeMaterial(material)
  if (estado === null) {
    return null
  }
  return 'completo' in estado ? 'Completo' : `Faltan ${estado.faltan}`
}

export function BloqueDeEntrenamiento({
  formulario,
  errores,
  deshabilitado,
  alCambiar
}: PropsDeBloque): ReactElement {
  const cambiar = (parcial: Partial<FormularioDeFicha>): void =>
    alCambiar({ ...formulario, ...parcial })
  const restantes = despertaresRestantes(formulario)
  return (
    <Bloque titulo="Entrenamiento">
      <CampoDeTexto
        etiqueta="Estrella actual"
        numerico
        valor={formulario.estrellaActual}
        error={errores['entrenamiento.estrella_actual']}
        deshabilitado={deshabilitado}
        alCambiar={(estrellaActual) => cambiar({ estrellaActual })}
      />
      <CampoDeTexto
        etiqueta="Nivel requerido de la siguiente etapa"
        numerico
        valor={formulario.nivelRequeridoSiguienteEtapa}
        error={errores['entrenamiento.nivel_requerido_siguiente_etapa']}
        deshabilitado={deshabilitado}
        alCambiar={(nivelRequeridoSiguienteEtapa) => cambiar({ nivelRequeridoSiguienteEtapa })}
      />
      <CampoDeTexto
        etiqueta="Ganancia por despertar"
        numerico
        valor={formulario.gananciaDespertar}
        error={errores['entrenamiento.ganancia_despertar']}
        deshabilitado={deshabilitado}
        alCambiar={(gananciaDespertar) => cambiar({ gananciaDespertar })}
      />
      <CampoDeTexto
        etiqueta="Ganancia por seis potenciales"
        numerico
        valor={formulario.gananciaSeisPotenciales}
        error={errores['entrenamiento.ganancia_seis_potenciales']}
        deshabilitado={deshabilitado}
        alCambiar={(gananciaSeisPotenciales) => cambiar({ gananciaSeisPotenciales })}
      />
      <CampoDeTexto
        etiqueta="Despertares usados"
        numerico
        valor={formulario.despertaresUsados}
        error={errores['entrenamiento.despertares_usados']}
        deshabilitado={deshabilitado}
        alCambiar={(despertaresUsados) => cambiar({ despertaresUsados })}
      />
      <CampoDeTexto
        etiqueta="Despertares totales"
        numerico
        valor={formulario.despertaresTotal}
        error={errores['entrenamiento.despertares_total']}
        deshabilitado={deshabilitado}
        alCambiar={(despertaresTotal) => cambiar({ despertaresTotal })}
      />
      {restantes !== null && <p className="derivado">Despertares restantes: {restantes}</p>}
      {formulario.materiales.map((material, indice) => {
        const clave = `entrenamiento.materiales.${indice}`
        const cambiarMaterial = (parcial: Partial<FormularioDeMaterial>): void =>
          alCambiar({
            ...formulario,
            materiales: formulario.materiales.map((actual, i) =>
              i === indice ? { ...actual, ...parcial } : actual
            )
          })
        const estado = material.nombre.trim() === '' ? null : textoDeEstado(material)
        return (
          <div className="fila-de-material" key={indice}>
            <CampoDeTexto
              etiqueta={`Material ${indice + 1} nombre`}
              valor={material.nombre}
              error={errores[`${clave}.nombre`]}
              deshabilitado={deshabilitado}
              alCambiar={(nombre) => cambiarMaterial({ nombre })}
            />
            <CampoDeTexto
              etiqueta={`Material ${indice + 1} tengo`}
              numerico
              valor={material.tengo}
              error={errores[`${clave}.tengo`]}
              deshabilitado={deshabilitado}
              alCambiar={(tengo) => cambiarMaterial({ tengo })}
            />
            <CampoDeTexto
              etiqueta={`Material ${indice + 1} necesito`}
              numerico
              valor={material.necesito}
              error={errores[`${clave}.necesito`]}
              deshabilitado={deshabilitado}
              alCambiar={(necesito) => cambiarMaterial({ necesito })}
            />
            {estado !== null && <p className="derivado">{estado}</p>}
          </div>
        )
      })}
    </Bloque>
  )
}

export function BloqueDeObjetos({
  formulario,
  errores,
  deshabilitado,
  alCambiar
}: PropsDeBloque): ReactElement {
  return (
    <Bloque titulo="Objetos transportados">
      {formulario.objetos.map((objeto, indice) => {
        const posicion = POSICIONES_DE_OBJETO_EN_ORDEN[indice] ?? 'equipado'
        const nombreDePosicion =
          POSICIONES_DE_OBJETO.find((p) => p.codigo === posicion)?.etiqueta.toLowerCase() ??
          posicion
        const prefijo = `Objeto ${nombreDePosicion}`
        const clave = `objetos.${indice}`
        const cambiarObjeto = (parcial: Partial<FormularioDeObjeto>): void =>
          alCambiar({
            ...formulario,
            objetos: formulario.objetos.map((actual, i) =>
              i === indice ? { ...actual, ...parcial } : actual
            )
          })
        return (
          <div className="fila-de-objeto" key={posicion}>
            <CampoDeTexto
              etiqueta={`${prefijo} nombre`}
              valor={objeto.nombre}
              error={errores[`${clave}.nombre`]}
              deshabilitado={deshabilitado}
              alCambiar={(nombre) => cambiarObjeto({ nombre })}
            />
            <CampoDeSeleccion
              etiqueta={`${prefijo} rareza`}
              valor={objeto.rareza}
              opciones={RAREZAS}
              error={errores[`${clave}.rareza`]}
              deshabilitado={deshabilitado}
              alCambiar={(rareza) => cambiarObjeto({ rareza })}
            />
            <CampoDeTexto
              etiqueta={`${prefijo} nivel`}
              numerico
              valor={objeto.nivel}
              error={errores[`${clave}.nivel`]}
              deshabilitado={deshabilitado}
              alCambiar={(nivel) => cambiarObjeto({ nivel })}
            />
            <CampoDeCasilla
              etiqueta={`${prefijo} contrato`}
              marcado={contratoHabilitado(objeto) && objeto.contrato}
              deshabilitado={deshabilitado || !contratoHabilitado(objeto)}
              alCambiar={(contrato) => cambiarObjeto({ contrato })}
            />
            <CampoDeArea
              etiqueta={`${prefijo} efecto núcleo`}
              valor={objeto.efectoNucleoNotas}
              error={errores[`${clave}.efecto_nucleo_notas`]}
              deshabilitado={deshabilitado}
              alCambiar={(efectoNucleoNotas) => cambiarObjeto({ efectoNucleoNotas })}
            />
          </div>
        )
      })}
    </Bloque>
  )
}

export function BloqueDeNotas({
  formulario,
  errores,
  deshabilitado,
  alCambiar
}: PropsDeBloque): ReactElement {
  return (
    <Bloque titulo="Habilidades y notas">
      <CampoDeArea
        etiqueta="Notas de habilidades"
        valor={formulario.notasHabilidades}
        error={errores.notas_habilidades}
        deshabilitado={deshabilitado}
        alCambiar={(notasHabilidades) => alCambiar({ ...formulario, notasHabilidades })}
      />
      <CampoDeArea
        etiqueta="Notas"
        valor={formulario.notas}
        error={errores.notas}
        deshabilitado={deshabilitado}
        alCambiar={(notas) => alCambiar({ ...formulario, notas })}
      />
    </Bloque>
  )
}
