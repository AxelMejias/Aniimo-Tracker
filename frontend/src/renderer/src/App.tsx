import type { ReactElement } from 'react'
import AuthScreen from './features/auth/AuthScreen'
import { useAuth } from './features/auth/useAuth'
import Principal from './pages/Principal'
import './shared/styles/tokens.css'

export default function App(): ReactElement {
  const { estado, iniciarSesion, registrarse, cerrarSesion, sesionVencida } = useAuth()

  if (estado.tipo === 'cargando') {
    return (
      <p className="app__cargando" role="status">
        Cargando…
      </p>
    )
  }
  if (estado.tipo === 'autenticado') {
    return (
      <Principal
        nombreUsuario={estado.nombreUsuario}
        alCerrarSesion={() => void cerrarSesion()}
        alSesionVencida={sesionVencida}
      />
    )
  }
  return (
    <AuthScreen
      aviso={estado.aviso}
      alIniciarSesion={iniciarSesion}
      alRegistrarse={registrarse}
    />
  )
}
