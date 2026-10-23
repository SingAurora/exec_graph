import type { ActionDocumentRevision, ActionExpression, ActionExpressionOrigin, ActionNode } from '../model/types'
import type { ChatMessage } from '../../../shared/model/content'
import { canEditActionDocument, getInheritedActionDocument, getInheritedActionDocumentOrigin, updateActionDocument } from './inherited-document'

/** 取得节点的有效表达，只沿主要承接来源继承，主动清空即停止。 */
export function getActionExpression(nodes: ActionNode[], nodeId: string): ActionExpression {
  return getInheritedActionDocument(nodes, nodeId, 'expressionMarkdown')
}

/** 跳过仅传递表达的中间节点，识别实际来源；空表达和首次表达不额外标来源。 */
export function getActionExpressionOrigin(nodes: ActionNode[], nodeId: string): ActionExpressionOrigin | undefined {
  return getInheritedActionDocumentOrigin(nodes, nodeId, 'expressionMarkdown')
}

/** 检查节点是否尚未被引用，从而允许补充、修改或清空有效表达。 */
export function canEditActionExpression(nodes: ActionNode[], nodeId: string): boolean {
  return canEditActionDocument(nodes, nodeId)
}

/** 只更新当前可编辑节点的表达；空正文表示主动清空，阻断继承。 */
export function updateActionExpression(nodes: ActionNode[], nodeId: string, markdown: string, editor: Pick<ActionDocumentRevision, 'authorId' | 'createdAt'>): ActionNode[] {
  return updateActionDocument(nodes, nodeId, 'expressionMarkdown', markdown, editor)
}

/** 保存 AI 对话形成的新表达及追加消息；保留行动事实和最初对话。 */
export function updateActionExpressionFromConversation(nodes: ActionNode[], nodeId: string, markdown: string, editor: Pick<ActionDocumentRevision, 'authorId' | 'createdAt'>, conversation: ChatMessage[]): ActionNode[] {
  const messages = conversation.filter((message) => !message.id.startsWith('error-') && message.id !== 'welcome')
  const last = messages.at(-1)
  if (last?.speaker !== 'ai' || !messages.some((message) => message.speaker === 'user')) return nodes
  const updated = updateActionExpression(nodes, nodeId, markdown, editor)
  if (updated === nodes) return nodes
  return updated.map((node) => node.id === nodeId ? { ...node, expressionConversation: messages } : node)
}

/** 找到未被其他节点引用的路线终点，包含孤立起点，按发布时间倒序排列。 */
export function getActionExpressionNodes(nodes: ActionNode[]): ActionNode[] {
  const referenced = new Set(nodes.flatMap((node) => [
    ...(node.parentId ? [node.parentId] : []),
    ...(node.mergedParentIds ?? []),
  ]))
  return sortActionsNewestFirst(nodes.filter((node) => !referenced.has(node.id)))
}

/** 按发布时间倒序；同一时间用稳定节点编号兜底，不修改传入数组。 */
export function sortActionsNewestFirst(nodes: ActionNode[]): ActionNode[] {
  return [...nodes].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.number - a.number)
}
