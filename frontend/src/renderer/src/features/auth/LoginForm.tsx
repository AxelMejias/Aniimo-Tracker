import { useState, type FormEvent, type ReactElement } from 'react'
import type { Credenciales, ErrorDeAuth } from '../../../../shared/auth'
import { mensajeDeError } from './mensajes'

interface LoginFormProps {
  readonly alEnviar: (credenciales: Credenciales) => Promise<ErrorDeAuth | null>
  readonly aviso: ErrorDeAuth | null
}

export default function LoginForm({ alEnviar, aviso }: LoginFormProps): ReactElement {
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault()
    if (enviando) {
      return
    }
    if (nombreUsuario === '' || contrasena === '') {
      setMensaje('Completá usuario y contraseña')
      return
    }
    setEnviando(true)
    const error = await alEnviar({ nombreUsuario, contrasena })
    setContrasena('')
    setMensaje(error === null ? null : mensajeDeError(error))
    setEnviando(false)
  }

  const textoDeAviso = mensaje ?? (aviso === null ? null : mensajeDeError(aviso))

  return (
    <form className="auth-form" onSubmit={(evento) => void enviar(evento)} noValidate>
      <h1 className="auth-form__title">Aniimo Team Tracker</h1>
      <h2 className="auth-form__subtitle">Iniciar sesión</h2>
      <label className="auth-form__field">
        Usuario
        <input
          className="auth-form__input"
          type="text"
          autoComplete="username"
          maxLength={64}
          value={nombreUsuario}
          onChange={(evento) => setNombreUsuario(evento.target.value)}
        />
      </label>
      <label className="auth-form__field">
        Contraseña
        <input
          className="auth-form__input"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          value={contrasena}
          onChange={(evento) => setContrasena(evento.target.value)}
        />
      </label>
      {textoDeAviso !== null && (
        <p className="auth-form__message" role="alert">
          {textoDeAviso}
        </p>
      )}
      <button className="auth-form__submit" type="submit" disabled={enviando}>
        Iniciar sesión
      </button>
    </form>
  )
}
