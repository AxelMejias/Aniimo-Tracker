import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import OverlayApp from './features/overlay/OverlayApp'
import { vistaDesdeHash } from './vista'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('No se encontró el elemento #root')
}

const Raiz = vistaDesdeHash(window.location.hash) === 'overlay' ? OverlayApp : App

createRoot(rootElement).render(
  <StrictMode>
    <Raiz />
  </StrictMode>
)
