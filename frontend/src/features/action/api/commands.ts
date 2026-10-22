import { postAPI, type BusinessRequestOptions } from '../../../shared/api/client'
import type { ActionContextNode } from '../../../entities/action/api/context'
import type { ChatMessage } from '../../../shared/model/content'

/** Explicit document intent preserves the difference between inheritance and clearing. */
export type DocumentUpdate = { mode: 'inherit' } | { mode: 'clear' } | { mode: 'update'; markdown: string }

/** A direct source assessment; null explicitly means it has not been assessed. */
export type SourceAssessment = { sourceId: string; complies: boolean | null; exceptionReason?: string }

/** Publication input contains source versions, never a client-assigned node number. */
export type CreateActionInput = {
  graphId: string
  parentId?: string
  mergedParentIds: string[]
  sourceVersions: { nodeId: string; version: number }[]
  title: string
  objectiveMarkdown: string
  expression: DocumentUpdate
  agreement: DocumentUpdate
  referenceAgreements: SourceAssessment[]
  conversation: ChatMessage[]
}

/** Publishes one action with independently generated expression and downstream agreement. */
export function createAction(input: CreateActionInput, options: BusinessRequestOptions): Promise<ActionContextNode> {
  return postAPI('/api/commands/actions/create', input, options)
}

/** Saves a continued AI expression turn on the existing endpoint. */
export function reviseExpression(input: { nodeId: string; expectedVersion: number; document: DocumentUpdate; conversation: ChatMessage[] }, options: BusinessRequestOptions): Promise<ActionContextNode> {
  return postAPI('/api/commands/expressions/update', input, options)
}

/** Saves downstream agreement changes without rewriting incoming source assessments. */
export function reviseAgreement(input: { nodeId: string; expectedVersion: number; document: DocumentUpdate }, options: BusinessRequestOptions): Promise<ActionContextNode> {
  return postAPI('/api/commands/agreements/update', input, options)
}

/** Converts the retained editor's optional Markdown into an explicit wire intent. */
export function documentUpdate(markdown: string | undefined): DocumentUpdate {
  return markdown === undefined ? { mode: 'inherit' } : markdown.trim() ? { mode: 'update', markdown } : { mode: 'clear' }
}
