import type { ActionExpression, ActionNode } from '../model/types'

/** Resolves expression along the primary parent only; explicit clears stop inheritance. */
export function getActionExpression(nodes: ActionNode[], nodeId: string): ActionExpression {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  let current = byId.get(nodeId)
  const projectId = current?.projectId
  const visited = new Set<string>()
  while (current && current.projectId === projectId && !visited.has(current.id)) {
    visited.add(current.id)
    if (current.expressionMarkdown !== undefined) {
      return { markdown: current.expressionMarkdown, sourceNode: current }
    }
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return { markdown: '' }
}

/** Lists current route endpoints, including an isolated starting node, newest first. */
export function getActionExpressionNodes(nodes: ActionNode[]): ActionNode[] {
  const referenced = new Set(nodes.flatMap((node) => [
    ...(node.parentId ? [node.parentId] : []),
    ...(node.mergedParentIds ?? []),
  ]))
  return sortActionsNewestFirst(nodes.filter((node) => !referenced.has(node.id)))
}

/** Orders published facts by timestamp, using the stable node number to break ties. */
export function sortActionsNewestFirst(nodes: ActionNode[]): ActionNode[] {
  return [...nodes].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.number - a.number)
}
