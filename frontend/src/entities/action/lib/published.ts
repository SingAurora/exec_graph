import type { ActionNode } from '../model/types'
import { getActionExpression, getActionExpressionNodes, sortActionsNewestFirst } from './expressions'

/** Resolves all route endpoints before filtering by author; cleared expressions stay absent. */
export function getPublishedExpressions(actions: ActionNode[], authorIds?: string[]): ActionNode[] {
  const graphs = new Map<string, ActionNode[]>()
  for (const node of actions) {
    const nodes = graphs.get(node.projectId) ?? []
    nodes.push(node)
    graphs.set(node.projectId, nodes)
  }
  const endpoints = [...graphs.values()].flatMap((nodes) => getActionExpressionNodes(nodes).filter((node) => (!authorIds || authorIds.includes(node.authorId)) && Boolean(getActionExpression(nodes, node.id).markdown.trim())))
  return sortActionsNewestFirst(endpoints)
}
