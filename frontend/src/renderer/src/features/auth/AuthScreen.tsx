import { useState, type ReactElement } from 'react'
import type { Credenciales, ErrorDeAuth } from '../../../../shared/auth'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import './auth.css'

interface AuthScreenProps {
  readonly aviso: ErrorDeAuth | null
  readonly alIniciarSesion: (credenciales: Credenciales) => Promise<ErrorDeAuth | null>
  readonly alRegistrarse: (credenciales: Credenciales) => Promise<ErrorDeAuth | null>
}

export default function AuthScreen({
  aviso,
  alIniciarSesion,
  alRegistrarse
}: AuthScreenProps): ReactElement {
  const [registrando, setRegistrando] = useState(false)

  return (
    <main className="auth-screen">
      {registrando ? (
        <RegisterForm alEnviar={alRegistrarse} />
      ) : (
        <LoginForm alEnviar={alIniciarSesion} aviso={aviso} />
      )}
      <button
        className="auth-screen__toggle"
        type="button"
        onClick={() => setRegistrando((actual) => !actual)}
      >
        {registrando ? 'Ya tengo cuenta' : 'Crear una cuenta'}
      </button>
    </main>
  )
}
