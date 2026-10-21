import type { ActionExpressionChange, ActionNode } from '../model/types'
import { getActionExpression, getActionExpressionOrigin } from './expressions'

/** Distinguishes an explicit clear from inherited emptiness and identifies actual document sources. */
export function getActionExpressionChange(actions: ActionNode[], nodeId: string): ActionExpressionChange {
  const node = actions.find((action) => action.id === nodeId)
  if (!node) return { kind: 'empty' }
  const expression = getActionExpression(actions, nodeId)
  if (!expression.markdown.trim()) return { kind: node.expressionMarkdown !== undefined ? 'cleared' : 'empty' }
  const origin = getActionExpressionOrigin(actions, nodeId)
  if (origin) return { kind: origin.kind, source: origin.node }
  return { kind: 'initial' }
}
