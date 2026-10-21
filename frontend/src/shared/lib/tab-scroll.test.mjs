import { describe, expect, test } from 'bun:test'
import { getRetainedTabScrollTop } from './tab-scroll.ts'

describe('retained tab scroll restoration', () => {
  test('first visits keep the visible navigation instead of resetting the profile to the top', () => {
    expect(getRetainedTabScrollTop(undefined, 632, 766)).toBe(632)
    expect(getRetainedTabScrollTop(undefined, 0, 766)).toBe(0)
  })

  test('first visits from deep lists start at the pinned navigation', () => {
    expect(getRetainedTabScrollTop(undefined, 1800, 766)).toBe(766)
  })

  test('switching while the profile header is visible keeps the navigation in place regardless of history', () => {
    expect(getRetainedTabScrollTop(1200, 632, 766)).toBe(632)
    expect(getRetainedTabScrollTop(0, 632, 766)).toBe(632)
    expect(getRetainedTabScrollTop(400, 632, 766)).toBe(632)
  })

  test('returning to a visited tab restores its reading position without unpinning the navigation', () => {
    expect(getRetainedTabScrollTop(1200, 900, 766)).toBe(1200)
    expect(getRetainedTabScrollTop(632, 1200, 766)).toBe(766)
    expect(getRetainedTabScrollTop(0, 1200, 766)).toBe(766)
    expect(getRetainedTabScrollTop(576, 936, 832)).toBe(832)
    expect(getRetainedTabScrollTop(0, 766, 766)).toBe(766)
  })
})
