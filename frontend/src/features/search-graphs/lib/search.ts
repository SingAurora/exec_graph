import { getGraphActivity } from '../../../entities/graph/lib/activity'
import type { GraphActivity, Graph } from '../../../entities/graph/model/types'
import type { ActionNode } from '../../../entities/action/model/types'
import { findSearchMatch } from '../../../shared/lib/search'

/** Searches every public graph by name or introduction, ordered by real activity then creation. */
export function searchPublicGraphs(graphs: Graph[], actions: ActionNode[], keyword: string): GraphActivity[] {
  const query = keyword.trim()
  if (!query) return []
  return graphs.filter((graph) => findSearchMatch(graph.title, query) !== -1 || findSearchMatch(graph.description, query) !== -1)
    .map((graph) => getGraphActivity(graph, actions))
    .sort((left, right) => Date.parse(right.lastActionAt ?? right.graph.createdAt) - Date.parse(left.lastActionAt ?? left.graph.createdAt)
      || left.graph.uuid.localeCompare(right.graph.uuid))
}
