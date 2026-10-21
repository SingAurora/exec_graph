import type { ActionReferenceAgreement } from '../../../entities/action/model/types'
import type { AIActionSourceAgreement } from './action-agreement-context'

/** AI assessment of a direct source; null leaves compliance unreviewed. */
export type AIActionAgreementReview = { nodeNumber: number; complies: boolean | null; reason: string }

/** Validates source-specific assessments without accepting unrelated or duplicate node numbers. */
export function readActionAgreementReviews(value: unknown, sources: AIActionSourceAgreement[]): AIActionAgreementReview[] {
  const numbers = new Set(sources.filter((source) => source.markdown.trim()).map((source) => source.nodeNumber))
  const reviews = new Map<number, AIActionAgreementReview>()
  if (value !== undefined) {
    if (!Array.isArray(value)) throw new Error('AI 返回的约定核对格式不完整，请重新发送。')
    for (const item of value) {
      if (!item || typeof item !== 'object') throw new Error('AI 返回的约定核对格式不完整，请重新发送。')
      const review = item as Partial<AIActionAgreementReview>
      if (typeof review.nodeNumber !== 'number' || !numbers.has(review.nodeNumber) || reviews.has(review.nodeNumber)
        || (review.complies !== true && review.complies !== false && review.complies !== null)
        || typeof review.reason !== 'string' || (review.complies === false && !review.reason.trim())) {
        throw new Error('AI 返回的约定核对与引用来源不一致，请重新发送。')
      }
      reviews.set(review.nodeNumber, { nodeNumber: review.nodeNumber, complies: review.complies, reason: review.reason.trim() })
    }
  }
  return [...numbers].map((nodeNumber) => reviews.get(nodeNumber) ?? { nodeNumber, complies: null, reason: '' })
}

/** Maps reviewed source numbers to trusted IDs; unknown assessments stay absent in published records. */
export function getReferenceAgreementRecords(sources: { sourceId: string; nodeNumber: number }[], reviews: AIActionAgreementReview[]): ActionReferenceAgreement[] {
  return sources.flatMap(({ sourceId, nodeNumber }) => {
    const review = reviews.find((item) => item.nodeNumber === nodeNumber)
    if (!review || review.complies === null) return []
    return [{ sourceId, complies: review.complies, ...(review.complies ? {} : { exceptionReason: review.reason }) }]
  })
}
