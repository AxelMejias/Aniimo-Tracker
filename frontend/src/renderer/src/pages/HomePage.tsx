import type { ReactElement } from 'react'
import './HomePage.css'

interface HomePageProps {
  readonly nombreUsuario: string
  readonly alCerrarSesion: () => void
}

export default function HomePage({ nombreUsuario, alCerrarSesion }: HomePageProps): ReactElement {
  return (
    <main className="home-page">
      <h1 className="home-page__title">Aniimo Team Tracker</h1>
      <p className="home-page__user">
        Sesión iniciada como <span className="home-page__username">{nombreUsuario}</span>
      </p>
      <button className="home-page__logout" type="button" onClick={alCerrarSesion}>
        Cerrar sesión
      </button>
    </main>
  )
}
