import { useState, type ReactElement, type ReactNode } from 'react'
import {
  ELEMENTOS,
  POSICIONES_DE_OBJETO,
  POTENCIALES_INNATOS,
  RAREZAS,
  ROLES,
  STATS
} from '../../../../shared/catalogos'
import type { FichaDeAmigo } from '../../../../shared/teams'
import CartaDeFicha from './CartaDeFicha'
import PestanasDeFicha from './PestanasDeFicha'
import './ficha.css'

interface FichaDeSoloLecturaProps {
  readonly ficha: FichaDeAmigo
  readonly imagen: string | null
}

const SIN_NOTAS = 'Sin notas'
const SIN_DATO = '—'

function etiquetaDe(
  catalogo: readonly { readonly codigo: string; readonly etiqueta: string }[],
  codigo: string | null
): string {
  return catalogo.find((opcion) => opcion.codigo === codigo)?.etiqueta ?? SIN_DATO
}

function Grupo({ children }: { children: ReactNode }): ReactElement {
  return <div className="bloque bloque__contenido">{children}</div>
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }): ReactElement {
  return (
    <div className="dato">
      <span className="dato__etiqueta">{etiqueta}</span>
      <span className="dato__valor">{valor}</span>
    </div>
  )
}

function Nota({ texto }: { texto: string | null }): ReactElement {
  return <span className={texto === null ? 'dato__vacio' : 'dato__nota'}>{texto ?? SIN_NOTAS}</span>
}

export default function FichaDeSoloLectura({
  ficha,
  imagen
}: FichaDeSoloLecturaProps): ReactElement {
  const { entrenamiento } = ficha
  const [activa, setActiva] = useState('generales')
  const generales = (
    <Grupo>
      <Dato etiqueta="Nombre" valor={ficha.nombre} />
      <Dato etiqueta="Elemento" valor={etiquetaDe(ELEMENTOS, ficha.elemento)} />
      <Dato etiqueta="Rol" valor={etiquetaDe(ROLES, ficha.rol)} />
      <Dato
        etiqueta="Potencial innato"
        valor={etiquetaDe(POTENCIALES_INNATOS, ficha.potencialInnato)}
      />
      <Dato etiqueta="Personalidad" valor={ficha.personalidad ?? SIN_DATO} />
      <Dato etiqueta="Nivel" valor={ficha.nivel} />
      <Dato etiqueta="CP" valor={ficha.cp} />
      <Dato etiqueta="Parche del juego" valor={ficha.fechaParche ?? 'desconocido'} />
    </Grupo>
  )
  const stats = (
    <Grupo>
      {STATS.map(({ codigo, etiqueta }) => {
        const stat = ficha.stats[codigo]
        return (
          <div className="fila-de-stat" key={codigo}>
            <span className="dato__etiqueta">{etiqueta}</span>
            <Dato etiqueta="Valor" valor={stat.valorActual} />
            <Dato etiqueta="Potencial" valor={stat.potencial} />
            <Dato etiqueta="Bono de estrellas" valor={stat.bonoEstrellasIncluido} />
            <Dato etiqueta="Notas" valor={<Nota texto={stat.notas} />} />
          </div>
        )
      })}
    </Grupo>
  )
  const entrenamientoPanel = (
    <Grupo>
      <Dato etiqueta="Estrella actual" valor={entrenamiento.estrellaActual} />
      <Dato
        etiqueta="Etapa de estrella"
        valor={ficha.etapaEstrella === null ? 'sin cargar' : `T${ficha.etapaEstrella}`}
      />
      <Dato
        etiqueta="Nivel requerido de la siguiente etapa"
        valor={entrenamiento.nivelRequeridoSiguienteEtapa ?? SIN_DATO}
      />
      <Dato etiqueta="Ganancia por despertar" valor={entrenamiento.gananciaDespertar} />
      <Dato
        etiqueta="Ganancia por seis potenciales"
        valor={entrenamiento.gananciaSeisPotenciales}
      />
      <Dato
        etiqueta="Despertares"
        valor={`${entrenamiento.despertaresUsados}/${entrenamiento.despertaresTotal}`}
      />
      {entrenamiento.materiales.map((material) => (
        <div className="fila-de-material" key={material.posicion}>
          <Dato etiqueta={`Material ${material.posicion}`} valor={material.nombre} />
          <Dato etiqueta="Tengo" valor={material.tengo} />
          <Dato etiqueta="Necesito" valor={material.necesito} />
        </div>
      ))}
    </Grupo>
  )
  const objetos = (
    <Grupo>
      {ficha.objetos.length === 0 && <span className="dato__vacio">Sin objetos</span>}
      {ficha.objetos.map((objeto) => (
        <div className="fila-de-objeto" key={objeto.posicion}>
          <Dato
            etiqueta={etiquetaDe(POSICIONES_DE_OBJETO, objeto.posicion)}
            valor={objeto.nombre}
          />
          <Dato etiqueta="Rareza" valor={etiquetaDe(RAREZAS, objeto.rareza)} />
          <Dato etiqueta="Nivel del objeto" valor={objeto.nivel} />
          <Dato etiqueta="Contrato" valor={objeto.contrato ? 'Sí' : 'No'} />
          <Dato etiqueta="Efecto núcleo" valor={<Nota texto={objeto.efectoNucleoNotas} />} />
        </div>
      ))}
    </Grupo>
  )
  const notas = (
    <Grupo>
      <Dato etiqueta="Notas de habilidades" valor={<Nota texto={ficha.notasHabilidades} />} />
      <Dato etiqueta="Notas" valor={<Nota texto={ficha.notas} />} />
    </Grupo>
  )

  return (
    <div className="ficha ficha--solo-lectura">
      <h2 className="ficha__titulo" tabIndex={-1}>
        Ficha de solo lectura: {ficha.nombre} (slot {ficha.slot})
      </h2>
      <div className="ficha__cuerpo">
        <CartaDeFicha
          nombre={ficha.nombre}
          nivel={String(ficha.nivel)}
          cp={String(ficha.cp)}
          elemento={ficha.elemento}
          rol={ficha.rol}
          personalidad={ficha.personalidad ?? ''}
          esPortada={false}
          imagen={imagen}
          altDeImagen="Imagen del Aniimo"
          potenciales={STATS.map(({ codigo, etiqueta }) => ({
            codigo,
            etiqueta,
            valor: ficha.stats[codigo].potencial
          }))}
        />
        <PestanasDeFicha
          activa={activa}
          alCambiar={setActiva}
          paneles={[
            { id: 'generales', etiqueta: 'Generales', contenido: generales },
            { id: 'stats', etiqueta: 'Stats', contenido: stats },
            { id: 'entrenamiento', etiqueta: 'Entrenamiento', contenido: entrenamientoPanel },
            { id: 'objetos', etiqueta: 'Objetos', contenido: objetos },
            { id: 'notas', etiqueta: 'Notas', contenido: notas }
          ]}
        />
      </div>
    </div>
  )
}
