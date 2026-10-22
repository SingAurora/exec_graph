import type { ChatMessage } from '../../shared/model/content'
import type { ActionReferenceAgreement } from '../../entities/action/model/types'
import type { DocumentUpdate } from '../../features/action/api/commands'
import { requireInput } from './protocol'

/** Reads an explicit inheritance, update or clearing intent. */
export function readDocument(value: unknown): DocumentUpdate {
  requireInput(value && typeof value === 'object' && 'mode' in value)
  if (value.mode === 'inherit' || value.mode === 'clear') {
    requireInput(Object.keys(value).length === 1)
    return { mode: value.mode }
  }
  requireInput(value.mode === 'update' && 'markdown' in value && typeof value.markdown === 'string' && value.markdown.trim())
  requireInput(Object.keys(value).every((key) => key === 'mode' || key === 'markdown'))
  return { mode: 'update', markdown: value.markdown }
}

/** Maps wire intent back to the current UI model without confusing omission and empty text. */
export function documentMarkdown(document: DocumentUpdate): string | undefined {
  return document.mode === 'inherit' ? undefined : document.mode === 'clear' ? '' : document.markdown
}

/** Validates continuous saved dialogue rather than accepting arbitrary client objects. */
export function readMessages(value: unknown): ChatMessage[] {
  requireInput(Array.isArray(value))
  return value.map((message: unknown) => {
    requireInput(message && typeof message === 'object' && 'id' in message && typeof message.id === 'string'
      && message.id !== 'welcome' && !message.id.startsWith('error-') && 'speaker' in message && (message.speaker === 'user' || message.speaker === 'ai') && 'body' in message && typeof message.body === 'string')
    return { id: message.id, speaker: message.speaker, body: message.body }
  })
}

/** Validates one assessment per supplied source, retaining unknown assessments as absent model records. */
export function readAssessments(value: unknown, sourceIds: string[]): ActionReferenceAgreement[] {
  requireInput(Array.isArray(value))
  const seen = new Set<string>()
  const records: ActionReferenceAgreement[] = []
  for (const item of value) {
    requireInput(item && typeof item === 'object' && typeof item.sourceId === 'string' && sourceIds.includes(item.sourceId) && !seen.has(item.sourceId))
    seen.add(item.sourceId)
    requireInput(item.complies === true || item.complies === false || item.complies === null)
    requireInput(item.exceptionReason === undefined || typeof item.exceptionReason === 'string')
    requireInput(item.complies !== false || item.exceptionReason?.trim(), '不满足约定时需要说明原因')
    if (item.complies !== null) records.push({ sourceId: item.sourceId, complies: item.complies, exceptionReason: item.exceptionReason })
  }
  requireInput(seen.size === sourceIds.length, '每个引用来源都需要明确评估状态')
  return records
}
