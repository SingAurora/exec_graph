import { describe, expect, test } from 'bun:test'
import { PROFILE_BIO_LIMIT } from '../model/limits.ts'
import { validateBiography } from './bio-validation.ts'

describe('profile biography validation', () => {
  test('counts Unicode code points instead of UTF-16 units', () => {
    expect(validateBiography('😀'.repeat(PROFILE_BIO_LIMIT))).toBeUndefined()
    expect(validateBiography('😀'.repeat(PROFILE_BIO_LIMIT + 1))).toContain(String(PROFILE_BIO_LIMIT))
  })

  test('ignores leading and trailing whitespace like the saved value', () => {
    expect(validateBiography(`  ${'字'.repeat(PROFILE_BIO_LIMIT)}  `)).toBeUndefined()
    expect(validateBiography(`  ${'字'.repeat(PROFILE_BIO_LIMIT + 1)}  `)).toContain(String(PROFILE_BIO_LIMIT))
  })
})
