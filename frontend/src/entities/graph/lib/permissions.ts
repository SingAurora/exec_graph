import type { ActionNode } from '../../action/model/types'
import type { Graph } from '../model/types'

/** Includes the creator, declared participants, and authors within this graph. */
export function isGraphParticipant(graph: Graph, userUuid: string, actions: ActionNode[]): boolean {
  return graph.ownerUuid === userUuid || graph.participantUuids.includes(userUuid)
    || actions.some((node) => node.graphUuid === graph.uuid && node.authorUuid === userUuid)
}

/** Shared explanation used by the disabled control and the deletion eligibility check. */
export function getGraphDeletionDisabledReason(graph: Graph, userUuid: string, actions: ActionNode[]): string | undefined {
  if (!isGraphParticipant(graph, userUuid, actions)) return '只有参与此图的用户可以删除'
  const participantUuids = new Set([graph.ownerUuid, ...graph.participantUuids,
    ...actions.filter((node) => node.graphUuid === graph.uuid).map((node) => node.authorUuid),
  ])
  if (participantUuids.size >= 2) return '已有其他用户参与，不能删除此图'
  return undefined
}

/** Deletion is limited to graphs with no participants other than the current user. */
export function canDeleteGraph(graph: Graph, userUuid: string, actions: ActionNode[]): boolean {
  return getGraphDeletionDisabledReason(graph, userUuid, actions) === undefined
}
