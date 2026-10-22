import { QueryClient } from '@tanstack/react-query'
import { BusinessRequestError } from '../../shared/api/errors'

/** Retries transient reads once, leaving cancellations and predictable business failures alone. */
export function retryBusinessQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof BusinessRequestError && (error.kind === 'network' || error.kind === 'timeout'
    || (error.kind === 'business' && [502, 503, 504].includes(error.status)))
}

/** Creates one application-owned cache; mutation failures never auto-replay writes. */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 600_000, refetchOnWindowFocus: false, retry: retryBusinessQuery },
    mutations: { retry: false },
  } })
}
