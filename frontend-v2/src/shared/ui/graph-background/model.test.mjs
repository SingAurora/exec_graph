import { describe, expect, test } from 'bun:test'
import { createDefaultGraphBackground, normalizeGraphBackground } from './model.ts'

describe('personal graph background preferences', () => {
  test('recovers defaults from absent, malformed, or unsupported saved preferences', () => {
    const defaults = createDefaultGraphBackground()
    for (const value of [null, undefined, 'dots', [], { style: 'unknown', dots: { size: 'large' } }]) {
      expect(normalizeGraphBackground(value)).toEqual(defaults)
    }
    const changed = createDefaultGraphBackground()
    changed.dots.size = 3
    expect(createDefaultGraphBackground().dots.size).toBe(2)
  })

  test('bounds and quantizes untrusted saved parameters without propagating invalid numbers', () => {
    const normalized = normalizeGraphBackground({
      style: 'crosses',
      dots: { spacing: -100, size: 200, intensity: 'strong' },
      grid: { spacing: 100, lineWidth: 0.8, intensity: 'standard' },
      crosses: { spacing: Infinity, size: NaN, lineWidth: -1, intensity: 'unknown' },
    })
    expect(normalized.dots).toEqual({ spacing: 16, size: 3, intensity: 'strong' })
    expect(normalized.grid).toEqual({ spacing: 40, lineWidth: 1, intensity: 'standard' })
    expect(normalized.crosses).toEqual({ spacing: 24, size: 4, lineWidth: 0.5, intensity: 'light' })
  })

  test('retains each pattern configuration through style changes and persistence', () => {
    const customized = createDefaultGraphBackground()
    customized.dots = { spacing: 32, size: 3, intensity: 'strong' }
    customized.grid = { spacing: 20, lineWidth: 0.5, intensity: 'standard' }
    customized.crosses = { spacing: 40, size: 8, lineWidth: 1.5, intensity: 'light' }
    for (const style of ['plain', 'dots', 'grid', 'crosses']) {
      const saved = { ...customized, style }
      expect(normalizeGraphBackground(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    }
  })
})
