import { describe, expect, test } from 'bun:test'
import { sortAIKeyConfigs } from './configurations.ts'

const platform = { id: 'platform', source: 'platform', isDefault: false }
const older = { id: 'older', source: 'personal', isDefault: false, createdAt: '2026-10-18T12:00:00+08:00' }
const newer = { id: 'newer', source: 'personal', isDefault: false, createdAt: '2026-10-20T12:00:00+08:00' }
const ids = (configs) => sortAIKeyConfigs(configs).map((config) => config.id)

describe('AI configuration display order', () => {
  test('pins the platform first regardless of input order or the active personal key', () => {
    expect(ids([newer, { ...older, isDefault: true }, platform])).toEqual(['platform', 'older', 'newer'])
  })

  test('orders inactive personal keys by actual creation time from newest to oldest', () => {
    const middle = { ...older, id: 'middle', createdAt: '2026-10-19T20:00:00Z' }
    expect(ids([older, platform, middle, newer])).toEqual(['platform', 'newer', 'middle', 'older'])
  })

  test('restores creation order when switching back to the platform', () => {
    const configs = [newer, { ...older, isDefault: true }, platform]
    const switched = configs.map((config) => ({ ...config, isDefault: config.id === 'platform' }))
    expect(ids(switched)).toEqual(['platform', 'newer', 'older'])
  })

  test('moves a newly saved key below the active personal key', () => {
    const newest = { ...newer, id: 'newest', createdAt: '2026-10-20T13:00:00+08:00' }
    expect(ids([platform, { ...older, isDefault: true }, newer, newest])).toEqual(['platform', 'older', 'newest', 'newer'])
  })

  test('keeps equal and missing timestamps stable without changing the original array', () => {
    const legacy = { id: 'legacy', isDefault: false }
    const invalid = { id: 'invalid', source: 'personal', isDefault: false, createdAt: 'invalid' }
    const tie = { ...newer, id: 'tie' }
    const configs = Object.freeze([legacy, newer, platform, invalid, tie])
    expect(ids(configs)).toEqual(['platform', 'newer', 'tie', 'legacy', 'invalid'])
    expect(configs.map((config) => config.id)).toEqual(['legacy', 'newer', 'platform', 'invalid', 'tie'])
    expect(ids([])).toEqual([])
  })
})
