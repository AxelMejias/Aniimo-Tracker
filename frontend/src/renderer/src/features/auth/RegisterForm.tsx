import { useId, useState, type FormEvent, type ReactElement } from 'react'
import type { Credenciales, ErrorDeAuth } from '../../../../shared/auth'
import { mensajeDeError } from './mensajes'
import { validarRegistro } from './validacionRegistro'

const AYUDA_DE_USUARIO = '3 a 32 letras, números o guion bajo.'
const AYUDA_DE_CONTRASENA = 'Mínimo 12 caracteres.'

interface RegisterFormProps {
  readonly alEnviar: (credenciales: Credenciales) => Promise<ErrorDeAuth | null>
}

export default function RegisterForm({ alEnviar }: RegisterFormProps): ReactElement {
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const idAyudaUsuario = useId()
  const idAyudaContrasena = useId()

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (enviando) {
      return
    }
    const credenciales = { nombreUsuario, contrasena }
    const problema = validarRegistro(credenciales)
    if (problema !== null) {
      setMensaje(problema)
      return
    }
    setEnviando(true)
    const error = await alEnviar(credenciales)
    setContrasena('')
    setMensaje(error === null ? null : mensajeDeError(error))
    setEnviando(false)
  }

  return (
    <form className="auth-form" onSubmit={(evento) => void enviar(evento)} noValidate>
      <h1 className="auth-form__title">Aniimo Team Tracker</h1>
      <h2 className="auth-form__subtitle">Crear cuenta</h2>
      <label className="auth-form__field">
        Usuario
        <input
          className="auth-form__input"
          type="text"
          autoComplete="username"
          maxLength={64}
          aria-describedby={idAyudaUsuario}
          value={nombreUsuario}
          onChange={(evento) => setNombreUsuario(evento.target.value)}
        />
      </label>
      <p className="auth-form__help" id={idAyudaUsuario}>
        {AYUDA_DE_USUARIO}
      </p>
      <label className="auth-form__field">
        Contraseña
        <input
          className="auth-form__input"
          type="password"
          autoComplete="new-password"
          maxLength={256}
          aria-describedby={idAyudaContrasena}
          value={contrasena}
          onChange={(evento) => setContrasena(evento.target.value)}
        />
      </label>
      <p className="auth-form__help" id={idAyudaContrasena}>
        {AYUDA_DE_CONTRASENA}
      </p>
      {mensaje !== null && (
        <p className="auth-form__message" role="alert">
          {mensaje}
        </p>
      )}
      <button className="auth-form__submit" type="submit" disabled={enviando}>
        {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
