import { API_ERROR_CODES } from '../api/contracts'
import { BusinessRequestError } from '../api/errors'

/** 从限流错误中读取机器可读的重试秒数；格式不符合时返回 undefined。 */
export function readRetryAfterSeconds(error: unknown): number | undefined {
    if (!(error instanceof BusinessRequestError) || error.code !== API_ERROR_CODES.rateLimited) return undefined

    const data = error.data
    if (!data || typeof data !== 'object' || !('retryAfter' in data)) return undefined

    const value = (data as { retryAfter?: unknown }).retryAfter
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined
}
