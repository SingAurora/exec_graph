import { getAPI } from '../../../shared/api/client'
import type { ActionNode } from '../model/types'

/** Complete graph context DTO used while the existing document selectors are migrated. */
export type ActionContextNode = Omit<ActionNode, 'projectId'> & { graphId: string; version: number }

/** Versioned action used by the existing projectId-based UI. */
export type VersionedAction = ActionNode & { version: number }

/** Scoped context keys keep account data and graph sets independent. */
export const actionKeys = {
  scope: (scope: string) => ['actions', scope] as const,
  contexts: (scope: string, graphIds: string[]) => ['actions', scope, 'contexts', [...graphIds].sort()] as const,
}

/** Explicitly adapts the graphId transport field to the retained frontend action shape. */
export function actionFromView({ graphId, ...node }: ActionContextNode): VersionedAction {
  return { ...node, projectId: graphId }
}

/** Reads complete graph-scoped contexts; this is not a paginated feed endpoint. */
export async function readActionContexts(graphIds: string[], signal?: AbortSignal): Promise<VersionedAction[]> {
  const groups = await Promise.all(graphIds.map((graphId) => getAPI<ActionContextNode[]>('/api/commands/actions/context', { graphId }, { signal })))
  return groups.flat().map(actionFromView)
}
