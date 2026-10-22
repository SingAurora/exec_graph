/** Failures which a business request can report without conflating cancellation with server errors. */
export type BusinessErrorKind = 'business' | 'network' | 'timeout' | 'protocol' | 'cancelled'

/** Structured request failure used by query retry policies and feature feedback. */
export class BusinessRequestError extends Error {
  constructor(message: string, readonly kind: BusinessErrorKind, readonly status = 0, readonly code?: number, readonly requestId?: string) {
    super(message)
    this.name = 'BusinessRequestError'
  }
}
