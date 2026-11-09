import { useState, type ReactElement } from 'react'
import type { Credenciales, ErrorDeAuth } from '../../../../shared/auth'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'
import './auth.css'

const AVISO_DE_NO_AFILIACION =
  'Herramienta de fans no oficial. Sin afiliación con los desarrolladores de Aniimo.'

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
      <div className="auth-marca">
        <div className="auth-marca__abanico" aria-hidden="true">
          <span className="auth-marca__carta auth-marca__carta--viento" />
          <span className="auth-marca__carta auth-marca__carta--hielo" />
          <span className="auth-marca__carta auth-marca__carta--fuego" />
        </div>
        <p className="auth-marca__rotulo">Colección</p>
        <h1 className="auth-marca__titulo">Aniimo Team Tracker</h1>
        <p className="auth-marca__aviso">{AVISO_DE_NO_AFILIACION}</p>
      </div>
      <div className="auth-panel">
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
      </div>
    </main>
  )
}
