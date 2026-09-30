import { describe, expect, it } from 'vitest'
import { buildExposedApi } from './api'

describe('buildExposedApi', () => {
  it('returns a frozen object with only appName', () => {
    const api = buildExposedApi()
    expect(Object.isFrozen(api)).toBe(true)
    expect(Object.keys(api)).toEqual(['appName'])
    expect(api.appName).toBe('Aniimo Team Tracker')
  })

  it('exposes no functions', () => {
    const api = buildExposedApi()
    for (const value of Object.values(api)) {
      expect(typeof value).not.toBe('function')
    }
  })
})
