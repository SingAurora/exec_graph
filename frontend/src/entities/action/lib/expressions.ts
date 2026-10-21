import type { ActionDocumentRevision, ActionExpression, ActionExpressionOrigin, ActionNode } from '../model/types'
import type { ChatMessage } from '../../../shared/model/content'
import { canEditActionDocument, getInheritedActionDocument, getInheritedActionDocumentOrigin, updateActionDocument } from './inherited-document'

/** Resolves expression along the primary parent only; explicit clears stop inheritance. */
export function getActionExpression(nodes: ActionNode[], nodeId: string): ActionExpression {
  return getInheritedActionDocument(nodes, nodeId, 'expressionMarkdown')
}

/** Skips inherited intermediates and never assigns an origin to empty or first expressions. */
export function getActionExpressionOrigin(nodes: ActionNode[], nodeId: string): ActionExpressionOrigin | undefined {
  return getInheritedActionDocumentOrigin(nodes, nodeId, 'expressionMarkdown')
}

/** An endpoint can supplement, modify or clear its effective expression. */
export function canEditActionExpression(nodes: ActionNode[], nodeId: string): boolean {
  return canEditActionDocument(nodes, nodeId)
}

/** Updates only the endpoint's expression; empty text explicitly stops inheritance. */
export function updateActionExpression(nodes: ActionNode[], nodeId: string, markdown: string, editor: Pick<ActionDocumentRevision, 'authorId' | 'createdAt'>): ActionNode[] {
  return updateActionDocument(nodes, nodeId, 'expressionMarkdown', markdown, editor)
}

/** Saves an AI revision and its continued dialogue together, leaving facts and the original dialogue intact. */
export function updateActionExpressionFromConversation(nodes: ActionNode[], nodeId: string, markdown: string, editor: Pick<ActionDocumentRevision, 'authorId' | 'createdAt'>, conversation: ChatMessage[]): ActionNode[] {
  const messages = conversation.filter((message) => !message.id.startsWith('error-') && message.id !== 'welcome')
  const last = messages.at(-1)
  if (last?.speaker !== 'ai' || !messages.some((message) => message.speaker === 'user')) return nodes
  const updated = updateActionExpression(nodes, nodeId, markdown, editor)
  if (updated === nodes) return nodes
  return updated.map((node) => node.id === nodeId ? { ...node, expressionConversation: messages } : node)
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
