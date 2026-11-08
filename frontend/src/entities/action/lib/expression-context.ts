import type { ActionExpressionContext, ActionNode } from '../model/types'
import { getActionContextIds } from './graph'

/** 修改表达的事实背景包含当前节点及承接／合入历史，排除无关分支和其他图。 */
export function getActionExpressionContext(nodes: ActionNode[], nodeUuid: string): ActionExpressionContext | undefined {
  const node = nodes.find((item) => item.uuid === nodeUuid)
  if (!node) return undefined
  const graph = nodes.filter((item) => item.graphUuid === node.graphUuid)
  const ids = getActionContextIds(graph, nodeUuid)
  return {
    nodeNumber: node.number,
    facts: graph.filter((item) => ids.has(item.uuid)).sort((a, b) => a.number - b.number)
      .map((item) => ({ number: item.number, authorUuid: item.authorUuid, title: item.title, markdown: item.objectiveMarkdown ?? item.markdown })),
  }
}
