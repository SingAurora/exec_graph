import type { ActionDocumentUpdateMode, ActionExpressionMessage } from '../../../entities/action/model/types'
import type { ChatMessage, PostImage } from '../../../shared/model/content'
import type { AIDocumentDetails, AIDocumentResult } from '../../../features/ai-key/api/chat'
import type { AIActionAgreementReview } from '../../../features/ai-key/lib/action-agreement-review'
import type { GenerationRequest, GenerationView } from '../../../features/action-generation/api/generation'

/** 编辑器阅读状态：当前预览栏目，以及每个面板独立的滚动位置。 */
export type WorkspaceView = {
  tab: 'conversation' | 'objective' | 'expression' | 'agreement'
  positions: Partial<Record<WorkspaceView['tab'], number>>
}

/** 一次连续对话中尚未发布的全部内容；本地保存不等于服务已接受发布。 */
export type ActionWorkspaceDraft = {
  images?: PostImage[]
  generationRequest?: GenerationRequest
  generation?: GenerationView
  pendingReports?: string[]
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
  generationRequest?: GenerationRequest
  generation?: GenerationView
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

/**
 * 追加一条业务性 AI 提示并永久保留：例如“请补充这次实际做了什么”。
 * 这类提示属于对话的一部分，不能被下一次请求当成临时错误清掉。
 */
export function appendWorkspaceNotice(messages: ChatMessage[], body: string): ChatMessage[] {
  return [...messages, { id: `notice-${crypto.randomUUID()}`, speaker: 'ai', body }]
}

/** 在最新对话后追加临时失败提示；只用于网络、超时等不代表 AI 发言的错误。 */
export function appendWorkspaceError(messages: ChatMessage[], body: string): ChatMessage[] {
  return [...messages.filter((message) => !message.id.startsWith('error-')), { id: `error-${Date.now()}`, speaker: 'ai', body }]
}

/** 将已保存的旧单句生成请求升级为消息批次，保留账号本地草稿。 */
export function normalizeGenerationRequest(request: GenerationRequest | undefined): GenerationRequest | undefined {
  if (!request || Array.isArray(request.input.messages)) return request
  const legacyInput = request.input as GenerationRequest['input'] & { message?: string }
  if (typeof legacyInput.message !== 'string') return request
  const { message, ...input } = legacyInput
  return { ...request, input: { ...input, messages: [message] } }
}

/** 恢复旧版未完成的行动生成时，把请求消息重新放回待整理列表。 */
export function pendingReportsForRestore(draft: ActionWorkspaceDraft): string[] {
  if (draft.pendingReports?.length) return draft.pendingReports
  if (draft.generation?.status === 'succeeded') return []
  const requested = normalizeGenerationRequest(draft.generationRequest)?.input.messages
  if (requested?.length) return requested
  let lastAssistant = -1
  draft.messages.forEach((message, index) => {
    if (message.speaker === 'ai' && !message.id.startsWith('error-')) lastAssistant = index
  })
  return draft.messages.slice(lastAssistant + 1).filter((message) => message.speaker === 'user').map((message) => message.body)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function isMessage(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && (value.speaker === 'ai' || value.speaker === 'user')
    && typeof value.body === 'string' && (value.authorId === undefined || typeof value.authorId === 'string')
    && (value.model === undefined || typeof value.model === 'string')
}
function isMessages(value: unknown): boolean { return Array.isArray(value) && value.every(isMessage) }
function isMode(value: unknown): boolean { return value === 'inherit' || value === 'update' || value === 'clear' }
function isGenerationState(value: Record<string, unknown>): boolean {
  const request = value.generationRequest, generation = value.generation
  if (request !== undefined) {
    if (!isRecord(request) || typeof request.key !== 'string' || !isRecord(request.input)
      || !['action', 'expression', 'agreement'].includes(String(request.input.mode)) || typeof request.input.graphId !== 'string'
      || !(Array.isArray(request.input.messages) || typeof request.input.message === 'string')
      || (Array.isArray(request.input.messages) && !request.input.messages.every((message) => typeof message === 'string'))
      || !Array.isArray(request.input.sourceVersions) || !Array.isArray(request.input.mergedParentIds)
      || !isRecord(request.input.agreement) || !isMode(request.input.agreement.mode)) return false
  }
  if (generation !== undefined && (!isRecord(generation) || typeof generation.generationId !== 'string'
    || typeof generation.conversationId !== 'string' || !['pending', 'succeeded', 'failed'].includes(String(generation.status)))) return false
  return true
}
function isView(value: unknown): boolean {
  const tabs = ['conversation', 'objective', 'expression', 'agreement']
  return isRecord(value) && tabs.includes(String(value.tab)) && isRecord(value.positions)
    && Object.entries(value.positions).every(([key, top]) => tabs.includes(key) && typeof top === 'number' && Number.isFinite(top) && top >= 0)
}

/** 本地存储可能含旧版或损坏数据，恢复前逐项验证结构；TS 类型不会自动校验存储内容。 */
export function isActionWorkspaceDraft(value: unknown): value is ActionWorkspaceDraft {
  if (!isRecord(value) || !isRecord(value.details) || !isRecord(value.expression)) return false
  const { details, expression } = value
  return isGenerationState(value) && isMessages(value.messages) && typeof value.input === 'string' && typeof value.document === 'string'
    && (value.pendingReports === undefined || (Array.isArray(value.pendingReports) && value.pendingReports.every((message) => typeof message === 'string')))
    && (value.images === undefined || (Array.isArray(value.images) && value.images.length <= 12 && value.images.every((image) => isRecord(image) && typeof image.assetId === 'string' && typeof image.url === 'string' && typeof image.alt === 'string')))
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
  return isRecord(value) && isGenerationState(value) && isMessages(value.messages) && typeof value.input === 'string'
    && (value.draftDocument === undefined || typeof value.draftDocument === 'string')
    && typeof value.generated === 'boolean' && typeof value.contextSignature === 'string' && isView(value.view)
}

/** 背景变化时保留可读草稿，但撤销已生成标记，要求重新对话核实后再提交。 */
export function reconcileWorkspaceDraft<T extends { generated: boolean; contextSignature: string }>(draft: T, contextSignature: string): T {
  return draft.contextSignature === contextSignature ? draft : { ...draft, generated: false }
}
