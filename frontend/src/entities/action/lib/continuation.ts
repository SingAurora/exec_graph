import type { ActionContinuationSource, ActionExpressionContext, ActionNode } from '../model/types'
import { getActionAgreement } from './agreements'
import { getActionContextIds } from './graph'
import { getActionExpressionNodes } from './expressions'

/** Lists same-graph route endpoints outside the primary source's already-known history. */
export function getActionMergeCandidates(nodes: ActionNode[], parentId: string): ActionNode[] {
  const parent = nodes.find((node) => node.id === parentId)
  if (!parent) return []
  const graph = nodes.filter((node) => node.projectId === parent.projectId)
  const known = getActionContextIds(graph, parentId)
  return getActionExpressionNodes(graph).filter((node) => !known.has(node.id)).sort((a, b) => b.number - a.number)
}

/** Validates direct sources and collects only their historical facts, once per node. */
export function getActionContinuationContext(nodes: ActionNode[], parentId: string, mergedIds: string[] = []): {
  sources: ActionContinuationSource[]
  facts: ActionExpressionContext['facts']
} | undefined {
  const parent = nodes.find((node) => node.id === parentId)
  if (!parent || new Set(mergedIds).size !== mergedIds.length) return undefined
  const candidates = new Map(getActionMergeCandidates(nodes, parentId).map((node) => [node.id, node]))
  if (mergedIds.some((id) => !candidates.has(id))) return undefined
  const graph = nodes.filter((node) => node.projectId === parent.projectId)
  const direct = [parent, ...mergedIds.map((id) => candidates.get(id)!)]
  const sources = direct.map((node, index): ActionContinuationSource => ({
    node, kind: index === 0 ? 'primary' : 'merged', agreement: getActionAgreement(graph, node.id),
  }))
  const known = new Set(direct.flatMap((node) => [...getActionContextIds(graph, node.id)]))
  const facts = graph.filter((node) => known.has(node.id)).sort((a, b) => a.number - b.number)
    .map((node) => ({ number: node.number, authorId: node.authorId, title: node.title, markdown: node.objectiveMarkdown ?? node.markdown }))
  return { sources, facts }
}
