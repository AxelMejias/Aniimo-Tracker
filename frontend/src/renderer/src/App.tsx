import type { ReactElement } from 'react'
import AuthScreen from './features/auth/AuthScreen'
import { useAuth } from './features/auth/useAuth'
import MisTeamsPage from './pages/MisTeamsPage'
import './shared/styles/tokens.css'

export default function App(): ReactElement | null {
  const { estado, iniciarSesion, registrarse, cerrarSesion, sesionVencida } = useAuth()

  if (estado.tipo === 'cargando') {
    return null
  }
  if (estado.tipo === 'autenticado') {
    return (
      <MisTeamsPage
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
