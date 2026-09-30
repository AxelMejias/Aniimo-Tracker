import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }

function assertNoRanges(deps: Record<string, string> | undefined): void {
  for (const [name, version] of Object.entries(deps ?? {})) {
    expect(version.startsWith('^'), `${name} usa rango ^`).toBe(false)
    expect(version.startsWith('~'), `${name} usa rango ~`).toBe(false)
  }
}

describe('package.json pins exact versions', () => {
  it('has no ^ or ~ ranges in dependencies', () => {
    assertNoRanges(packageJson.dependencies)
  })

  it('has no ^ or ~ ranges in devDependencies', () => {
    assertNoRanges(packageJson.devDependencies)
  })
})
