import type { ActionExpressionContext, ActionNode } from '../model/types'
import { getActionContextIds } from './graph'

/** 修改表达的事实背景包含当前节点及承接／合入历史，排除无关分支和其他图。 */
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
