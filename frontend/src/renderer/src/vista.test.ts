import { describe, expect, it } from 'vitest'
import { vistaDesdeHash } from './vista'

describe('vistaDesdeHash', () => {
  it('con #overlay devuelve el overlay', () => {
    expect(vistaDesdeHash('#overlay')).toBe('overlay')
  })

  it.each(['', '#otra', '#overlay2', '#/overlay', 'overlay'])(
    'con %j devuelve la app principal',
    (hash) => {
      expect(vistaDesdeHash(hash)).toBe('principal')
    }
  )
})
