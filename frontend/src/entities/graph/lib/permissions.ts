import type { ActionNode } from '../../action/model/types'
import type { Graph } from '../model/types'

/** Includes the creator, declared participants, and authors within this graph. */
export function isGraphParticipant(graph: Graph, userId: string, actions: ActionNode[]): boolean {
  return graph.ownerId === userId || graph.participantIds.includes(userId)
    || actions.some((node) => node.graphId === graph.uuid && node.authorId === userId)
}

/** Shared explanation used by the disabled control and the deletion eligibility check. */
export function getGraphDeletionDisabledReason(graph: Graph, userId: string, actions: ActionNode[]): string | undefined {
  if (!isGraphParticipant(graph, userId, actions)) return '只有参与此图的用户可以删除'
  const participantIds = new Set([graph.ownerId, ...graph.participantIds,
    ...actions.filter((node) => node.graphId === graph.uuid).map((node) => node.authorId),
  ])
  if (participantIds.size >= 2) return '已有其他用户参与，不能删除此图'
  return undefined
}

/** Deletion is limited to graphs with no participants other than the current user. */
export function canDeleteGraph(graph: Graph, userId: string, actions: ActionNode[]): boolean {
  return getGraphDeletionDisabledReason(graph, userId, actions) === undefined
}
