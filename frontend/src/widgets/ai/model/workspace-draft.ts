import type { ActionDocumentUpdateMode, ActionExpressionMessage } from '../../../entities/action/model/types'
import type { ChatMessage } from '../../../shared/model/content'
import type { AIDocumentDetails, AIDocumentResult } from '../../../features/ai-key/api/chat'
import type { AIActionAgreementReview } from '../../../features/ai-key/lib/action-agreement-review'

/** 编辑器阅读状态：当前预览栏目，以及每个面板独立的滚动位置。 */
export type WorkspaceView = {
  tab: 'conversation' | 'objective' | 'expression' | 'agreement'
  positions: Partial<Record<WorkspaceView['tab'], number>>
}

/** 一次连续对话中尚未发布的全部内容；本地保存不等于服务已接受发布。 */
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

/** 已有节点表达的追加对话草稿；draftDocument 为空字符串时表示明确清空。 */
export type ExpressionWorkspaceDraft = {
  messages: ActionExpressionMessage[]
  input: string
  draftDocument?: string
  generated: boolean
  contextSignature: string
  view: WorkspaceView
}

/** 新工作区默认打开对话，不预设各文档的阅读位置。 */
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

/** 本地存储可能含旧版或损坏数据，恢复前逐项验证结构；TS 类型不会自动校验存储内容。 */
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

/** 校验表达草稿，同时允许“已生成的空表达”，保留主动清空语义。 */
export function isExpressionWorkspaceDraft(value: unknown): value is ExpressionWorkspaceDraft {
  return isRecord(value) && isMessages(value.messages) && typeof value.input === 'string'
    && (value.draftDocument === undefined || typeof value.draftDocument === 'string')
    && typeof value.generated === 'boolean' && typeof value.contextSignature === 'string' && isView(value.view)
}

/** 背景变化时保留可读草稿，但撤销已生成标记，要求重新对话核实后再提交。 */
export function reconcileWorkspaceDraft<T extends { generated: boolean; contextSignature: string }>(draft: T, contextSignature: string): T {
  return draft.contextSignature === contextSignature ? draft : { ...draft, generated: false }
}
