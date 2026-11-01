import { describe, expect, test } from 'bun:test'
import { findMainlandLocation, mainlandRegions } from './mainland-regions.ts'

describe('mainland profile locations', () => {
  test('contains mainland province, city and district levels', () => {
    expect(mainlandRegions).toHaveLength(31)
    expect(findMainlandLocation('350206')).toMatchObject({ province: '福建省', city: '厦门市', district: '湖里区' })
    expect(findMainlandLocation('810001')).toBeUndefined()
  })
})
