// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('shows the app heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Aniimo Team Tracker' })).toBeInTheDocument()
  })

  it('renders no inline style attributes', () => {
    const { container } = render(<App />)
    const styled = container.querySelectorAll('[style]')
    expect(styled.length).toBe(0)
  })
})
