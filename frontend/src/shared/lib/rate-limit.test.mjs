import { describe, expect, test } from 'bun:test'
import { API_ERROR_CODES } from '../api/contracts.ts'
import { BusinessRequestError } from '../api/errors.ts'
import { readRetryAfterSeconds } from './rate-limit.ts'

describe('rate limit error details', () => {
  test('reads and rounds retryAfter from a rate-limited business error', () => {
    const error = new BusinessRequestError('稍后再试', 'business', 429, API_ERROR_CODES.rateLimited, 'trace', { retryAfter: 42.2 })
    expect(readRetryAfterSeconds(error)).toBe(43)
  })

  test('ignores other codes and malformed details', () => {
    expect(readRetryAfterSeconds(new Error('network'))).toBeUndefined()
    expect(readRetryAfterSeconds(new BusinessRequestError('失败', 'business', 400, 10001, 'trace', { retryAfter: 42 }))).toBeUndefined()
    expect(readRetryAfterSeconds(new BusinessRequestError('失败', 'business', 429, API_ERROR_CODES.rateLimited, 'trace', null))).toBeUndefined()
    expect(readRetryAfterSeconds(new BusinessRequestError('失败', 'business', 429, API_ERROR_CODES.rateLimited, 'trace', { retryAfter: '42' }))).toBeUndefined()
  })
})
