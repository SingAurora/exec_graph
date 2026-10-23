import type { ActionExpressionChange, ActionNode } from '../model/types'
import { getActionExpression, getActionExpressionOrigin } from './expressions'

/** 形成过程用的表达状态：区分主动清空和原本为空，同时标识继承或修改来源。 */
export function getActionExpressionChange(actions: ActionNode[], nodeId: string): ActionExpressionChange {
  const node = actions.find((action) => action.id === nodeId)
  if (!node) return { kind: 'empty' }
  const expression = getActionExpression(actions, nodeId)
  if (!expression.markdown.trim()) return { kind: node.expressionMarkdown !== undefined ? 'cleared' : 'empty' }
  const origin = getActionExpressionOrigin(actions, nodeId)
  if (origin) return { kind: origin.kind, source: origin.node }
  return { kind: 'initial' }
}
