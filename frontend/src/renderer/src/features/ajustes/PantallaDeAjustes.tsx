import { useEffect, useState, type ReactElement } from 'react'
import type { ClaveDePreferencia, Preferencias } from '../../../../shared/preferencias'
import './ajustes.css'

const AYUDA_DETECCION =
  'La app se fija cada 5 segundos en la lista de programas abiertos de Windows (lo mismo que ves en el Administrador de tareas) para saber si Aniimo está abierto. No lee, no toca y no se mete en el juego. Muestra la ventana de la app sin sacarle el teclado al juego; si no iniciaste sesión, ves el login.'
const AYUDA_SEGUNDO_PLANO =
  'La app arranca sola al prender la PC y queda en el área de notificación, sin ventana. La podés cerrar desde el ícono con «Salir».'
const ERROR_AL_LEER = 'No se pudieron leer los ajustes'
const ERROR_AL_GUARDAR = 'No se pudo guardar el cambio'

interface CasillaProps {
  readonly id: string
  readonly etiqueta: string
  readonly ayuda: string
  readonly marcada: boolean
  readonly deshabilitada: boolean
  readonly alCambiar: (valor: boolean) => void
}

function Casilla({ id, etiqueta, ayuda, marcada, deshabilitada, alCambiar }: CasillaProps): ReactElement {
  return (
    <div className="ajustes__opcion">
      <label className="ajustes__etiqueta" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={marcada}
          disabled={deshabilitada}
          aria-describedby={`${id}-ayuda`}
          onChange={(evento) => alCambiar(evento.target.checked)}
        />
        {etiqueta}
      </label>
      <p className="ajustes__ayuda" id={`${id}-ayuda`}>
        {ayuda}
      </p>
    </div>
  )
}

export default function PantallaDeAjustes(): ReactElement {
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    void window.aniimo.preferencias.obtener().then((resultado) => {
      if (!vigente) {
        return
      }
      if (resultado.ok) {
        setPreferencias(resultado.preferencias)
      } else {
        setError(ERROR_AL_LEER)
      }
    })
    return () => {
      vigente = false
    }
  }, [])

  async function cambiar(clave: ClaveDePreferencia, valor: boolean): Promise<void> {
    setGuardando(true)
    setError(null)
    const resultado = await window.aniimo.preferencias.cambiar({ clave, valor })
    setGuardando(false)
    if (resultado.ok) {
      setPreferencias(resultado.preferencias)
    } else {
      setError(ERROR_AL_GUARDAR)
    }
  }

  return (
    <section className="principal__seccion ajustes">
      <h2 className="principal__subtitulo" tabIndex={-1}>
        Ajustes
      </h2>
      {error !== null && (
        <p className="ajustes__error" role="alert">
          {error}
        </p>
      )}
      <Casilla
        id="ajuste-abrir-con-el-juego"
        etiqueta="Abrir la app cuando arranca Aniimo"
        ayuda={AYUDA_DETECCION}
        marcada={preferencias?.abrirAppConElJuego ?? false}
        deshabilitada={preferencias === null || guardando}
        alCambiar={(valor) => void cambiar('abrirAppConElJuego', valor)}
      />
      <Casilla
        id="ajuste-arrancar-con-windows"
        etiqueta="Arrancar con Windows en segundo plano"
        ayuda={AYUDA_SEGUNDO_PLANO}
        marcada={preferencias?.arrancarConWindows ?? false}
        deshabilitada={preferencias === null || !preferencias.segundoPlanoDisponible || guardando}
        alCambiar={(valor) => void cambiar('arrancarConWindows', valor)}
      />
    </section>
  )
}
