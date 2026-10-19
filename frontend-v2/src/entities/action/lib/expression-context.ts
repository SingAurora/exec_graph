import type { ActionExpressionContext, ActionNode } from '../model/types'
import { getActionContextIds } from './graph'

/** Includes current and cited facts across all parents, excluding unrelated branches and other graphs. */
export function getActionExpressionContext(nodes: ActionNode[], nodeId: string): ActionExpressionContext | undefined {
  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return undefined
  const graph = nodes.filter((item) => item.projectId === node.projectId)
  const ids = getActionContextIds(graph, nodeId)
  return {
    nodeNumber: node.number,
    facts: graph.filter((item) => ids.has(item.id)).sort((a, b) => a.number - b.number)
      .map((item) => ({ number: item.number, authorId: item.authorId, title: item.title, markdown: item.objectiveMarkdown ?? item.markdown })),
  }
}
