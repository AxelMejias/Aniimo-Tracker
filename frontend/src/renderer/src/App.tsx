import type { ReactElement } from 'react'
import AuthScreen from './features/auth/AuthScreen'
import { useAuth } from './features/auth/useAuth'
import HomePage from './pages/HomePage'
import './shared/styles/tokens.css'

export default function App(): ReactElement | null {
  const { estado, iniciarSesion, registrarse, cerrarSesion } = useAuth()

  if (estado.tipo === 'cargando') {
    return null
  }
  if (estado.tipo === 'autenticado') {
    return (
      <HomePage nombreUsuario={estado.nombreUsuario} alCerrarSesion={() => void cerrarSesion()} />
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
