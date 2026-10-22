import { getAPI } from '../../../shared/api/client'
import type { Project } from '../model/types'

/** Server-owned graph metadata with a concurrency version. */
export type GraphView = Project & { version: number }

/** Cache identity for the transitional complete graph catalogue. */
export const graphKeys = { catalogue: (scope: string) => ['graphs', scope, 'catalogue'] as const }

/** Reads the metadata catalogue used by the existing graph selectors. */
export function readGraphCatalogue(signal?: AbortSignal): Promise<GraphView[]> {
  return getAPI('/api/commands/graphs/catalogue', {}, { signal })
}
