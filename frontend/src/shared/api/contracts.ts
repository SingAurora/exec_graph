/** Stable general business error codes shared by the API contract and development mocks. */
export const API_ERROR_CODES = {
  invalidArgument: 10001,
  unauthenticated: 10002,
  forbidden: 10003,
  notFound: 10004,
  conflict: 10005,
  rateLimited: 10006,
  internal: 10007,
  unavailable: 10008,
  upstream: 10009,
} as const

/** A decoded business JSON envelope; nonzero codes, including unknown codes, indicate failure. */
export type APIResponse<T> = {
  code: number
  msg: string
  data: T | null
}

/** Continuation parameters for an ordinary content stream; an absent cursor starts the stream. */
export type CursorPaginationInput = {
  cursor?: string
  limit?: number
}

/** One stream batch; a null nextCursor is the only end-of-stream indicator. */
export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
}

/** Explicit numbered pagination for submitted searches, starting at page one. */
export type SearchPaginationInput = {
  page: number
  pageSize: number
}

/** A search page with the total number of matches for the same submitted criteria. */
export type SearchPage<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

/** First-version defaults for business requests, shared by future clients and mock handlers. */
export const API_REQUEST_DEFAULTS = {
  pageSize: 6,
  maxPageSize: 50,
  timeoutMs: 15_000,
} as const
