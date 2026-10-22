import { postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { GraphView } from '../../../entities/project/api/graphs'
import type { CreateProjectInput } from '../model/types'

/** Graph settings accepted by the versioned update command. */
export type UpdateGraphInput = { graphId: string; expectedVersion: number; title: string; description: string; avatar?: string; backgroundImage?: string }

/** Creates an empty graph; its first action is a separate command. */
export function createGraph(input: CreateProjectInput, options: BusinessRequestOptions): Promise<GraphView> {
  return postAPI('/api/commands/graphs/create', input, options)
}

/** Saves graph identity only if the current version is still editable. */
export function updateGraph(input: UpdateGraphInput, options: BusinessRequestOptions): Promise<GraphView> {
  return postAPI('/api/commands/graphs/update', input, options)
}

/** Removes a graph after server-side participant and node-count checks. */
export function removeGraph(input: { graphId: string; expectedVersion: number; expectedNodeCount: number }, options: BusinessRequestOptions): Promise<null> {
  return postAPI('/api/commands/graphs/delete', input, options)
}
