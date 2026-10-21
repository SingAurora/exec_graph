import type { ActionDocumentUpdateMode, ActionExpressionMessage } from '../../../entities/action/model/types'
import type { ChatMessage } from '../../../shared/model'
import type { AIDocumentDetails, AIDocumentResult } from '../../../features/ai-key/api/chat'
import type { AIActionAgreementReview } from '../../../features/ai-key/lib/action-agreement-review'

/** A workspace's selected preview and its independent panel scroll positions. */
export type WorkspaceView = {
  tab: 'conversation' | 'objective' | 'expression' | 'agreement'
  positions: Partial<Record<WorkspaceView['tab'], number>>
}

/** Everything the user has not yet published from a continuous action dialogue. */
export type ActionWorkspaceDraft = {
  messages: ChatMessage[]
  input: string
  document: string
  details: AIDocumentDetails
  generated: boolean
  expression: NonNullable<AIDocumentResult['expression']>
  agreementMode: ActionDocumentUpdateMode
  agreementDraft: string
  agreementReviews: AIActionAgreementReview[]
  mergedParentIds: string[]
  sourcesChanged: boolean
  contextSignature: string
  view: WorkspaceView
}

/** Unpublished expression turns continue the existing node's original conversation. */
export type ExpressionWorkspaceDraft = {
  messages: ActionExpressionMessage[]
  input: string
  draftDocument?: string
  generated: boolean
  contextSignature: string
  view: WorkspaceView
}

/** Starts a new editor on its continuous conversation. */
export function createWorkspaceView(): WorkspaceView {
  return { tab: 'conversation', positions: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function isMessage(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && (value.speaker === 'ai' || value.speaker === 'user')
    && typeof value.body === 'string' && (value.authorId === undefined || typeof value.authorId === 'string')
}
function isMessages(value: unknown): boolean { return Array.isArray(value) && value.every(isMessage) }
function isMode(value: unknown): boolean { return value === 'inherit' || value === 'update' || value === 'clear' }
function isView(value: unknown): boolean {
  const tabs = ['conversation', 'objective', 'expression', 'agreement']
  return isRecord(value) && tabs.includes(String(value.tab)) && isRecord(value.positions)
    && Object.entries(value.positions).every(([key, top]) => tabs.includes(key) && typeof top === 'number' && Number.isFinite(top) && top >= 0)
}

/** Validates persisted action data before it can become editable state. */
export function isActionWorkspaceDraft(value: unknown): value is ActionWorkspaceDraft {
  if (!isRecord(value) || !isRecord(value.details) || !isRecord(value.expression)) return false
  const { details, expression } = value
  return isMessages(value.messages) && typeof value.input === 'string' && typeof value.document === 'string'
    && typeof details.title === 'string' && typeof details.description === 'string' && typeof details.note === 'string'
    && Array.isArray(details.points) && details.points.every((point) => typeof point === 'string')
    && typeof value.generated === 'boolean' && isMode(expression.mode) && typeof expression.markdown === 'string'
    && isMode(value.agreementMode) && typeof value.agreementDraft === 'string'
    && Array.isArray(value.agreementReviews) && value.agreementReviews.every((review) => isRecord(review)
      && typeof review.nodeNumber === 'number' && Number.isFinite(review.nodeNumber)
      && (review.complies === true || review.complies === false || review.complies === null) && typeof review.reason === 'string')
    && Array.isArray(value.mergedParentIds) && value.mergedParentIds.every((id) => typeof id === 'string')
    && typeof value.sourcesChanged === 'boolean' && typeof value.contextSignature === 'string' && isView(value.view)
}

/** Validates expression drafts while preserving an explicitly empty generated expression. */
export function isExpressionWorkspaceDraft(value: unknown): value is ExpressionWorkspaceDraft {
  return isRecord(value) && isMessages(value.messages) && typeof value.input === 'string'
    && (value.draftDocument === undefined || typeof value.draftDocument === 'string')
    && typeof value.generated === 'boolean' && typeof value.contextSignature === 'string' && isView(value.view)
}

/** Changed factual backgrounds keep the draft readable but require another AI turn before publishing. */
export function reconcileWorkspaceDraft<T extends { generated: boolean; contextSignature: string }>(draft: T, contextSignature: string): T {
  return draft.contextSignature === contextSignature ? draft : { ...draft, generated: false }
}
