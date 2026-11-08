import { sortActionsNewestFirst } from '../../action/lib/expressions'
import { getPublishedExpressions } from '../../action/lib/published'
import type { ActionNode } from '../../action/model/types'
import type { Graph, GraphActivity } from '../model/types'

/** Uses actual published contributions instead of the obsolete participant list. */
export function hasUserContributed(graphId: string, userId: string, actions: ActionNode[]): boolean {
  return actions.some((node) => node.graphId === graphId && node.authorId === userId)
}

/** Summarizes public actions and nonempty expressions at current route endpoints. */
export function getGraphActivity(graph: Graph, actions: ActionNode[]): GraphActivity {
  const nodes = actions.filter((node) => node.graphId === graph.uuid)
  return {
    graph,
    actionCount: nodes.length,
    expressionCount: getPublishedExpressions(nodes).length,
    participantCount: new Set(nodes.map((node) => node.authorId)).size,
    lastActionAt: sortActionsNewestFirst(nodes)[0]?.createdAt,
  }
}

/** Lists graphs with published actions by their latest action, independent of metadata edits. */
export function getActiveGraphActivities(graphs: Graph[], actions: ActionNode[]): GraphActivity[] {
  const byGraph = new Map<string, ActionNode[]>()
  for (const action of actions) {
    const nodes = byGraph.get(action.graphId) ?? []
    nodes.push(action)
    byGraph.set(action.graphId, nodes)
  }
  return graphs.filter((graph) => byGraph.has(graph.uuid))
    .map((graph) => getGraphActivity(graph, byGraph.get(graph.uuid)!))
    .sort((a, b) => Date.parse(b.lastActionAt!) - Date.parse(a.lastActionAt!) || a.graph.uuid.localeCompare(b.graph.uuid))
}
