import type { ActionNode } from '../model/types'
import { getActionExpression, getActionExpressionNodes, sortActionsNewestFirst } from './expressions'

/** 先按完整图找路线终点，再按作者筛选非空表达；先筛作者会把中间节点误判成终点。 */
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
