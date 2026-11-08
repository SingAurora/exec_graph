import type { ActionContinuationSource, ActionExpressionContext, ActionNode } from '../model/types'
import { getActionAgreement } from './agreements'
import { getActionContextIds } from './graph'
import { getActionExpressionNodes } from './expressions'

/** 可合入来源仅限同图的其他路线终点，排除主要承接链已知的历史。 */
export function getActionMergeCandidates(nodes: ActionNode[], parentUuid: string): ActionNode[] {
  const parent = nodes.find((node) => node.uuid === parentUuid)
  if (!parent) return []
  const graph = nodes.filter((node) => node.graphUuid === parent.graphUuid)
  const known = getActionContextIds(graph, parentUuid)
  return getActionExpressionNodes(graph).filter((node) => !known.has(node.uuid)).sort((a, b) => b.number - a.number)
}

/** 校验承接与合入来源，汇总它们实际可达的历史事实；共享祖先只计一次。 */
export function getActionContinuationContext(nodes: ActionNode[], parentUuid: string, mergedIds: string[] = []): {
  sources: ActionContinuationSource[]
  facts: ActionExpressionContext['facts']
} | undefined {
  const parent = nodes.find((node) => node.uuid === parentUuid)
  if (!parent || new Set(mergedIds).size !== mergedIds.length) return undefined
  const candidates = new Map(getActionMergeCandidates(nodes, parentUuid).map((node) => [node.uuid, node]))
  if (mergedIds.some((id) => !candidates.has(id))) return undefined
  const graph = nodes.filter((node) => node.graphUuid === parent.graphUuid)
  const direct = [parent, ...mergedIds.map((id) => candidates.get(id)!)]
  const sources = direct.map((node, index): ActionContinuationSource => ({
    node, kind: index === 0 ? 'primary' : 'merged', agreement: getActionAgreement(graph, node.uuid),
  }))
  // AI 背景和来源计数使用同一集合；图里存在但未被引用的其他分支不属于已知事实。
  const known = new Set(direct.flatMap((node) => [...getActionContextIds(graph, node.uuid)]))
  const facts = graph.filter((node) => known.has(node.uuid)).sort((a, b) => a.number - b.number)
    .map((node) => ({ number: node.number, authorUuid: node.authorUuid, title: node.title, markdown: node.objectiveMarkdown ?? node.markdown }))
  return { sources, facts }
}
