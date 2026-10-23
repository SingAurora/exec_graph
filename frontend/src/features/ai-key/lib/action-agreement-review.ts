import type { ActionReferenceAgreement } from '../../../entities/action/model/types'
import type { AIActionSourceAgreement } from './action-agreement-context'

/** AI 对一份直接来源约定的核对结果；null 表示信息不足或未核对，不代表满足。 */
export type AIActionAgreementReview = { nodeNumber: number; complies: boolean | null; reason: string }

/** 校验 AI 核对结果，只接受真实来源且不允许重复；不满足必须说明原因，缺项补为未知。 */
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

/** 用可信来源表将 AI 返回的编号映射为节点 ID；未知结果暂不写入模型，由提交层转为 null。 */
export function getReferenceAgreementRecords(sources: { sourceId: string; nodeNumber: number }[], reviews: AIActionAgreementReview[]): ActionReferenceAgreement[] {
  return sources.flatMap(({ sourceId, nodeNumber }) => {
    const review = reviews.find((item) => item.nodeNumber === nodeNumber)
    if (!review || review.complies === null) return []
    return [{ sourceId, complies: review.complies, ...(review.complies ? {} : { exceptionReason: review.reason }) }]
  })
}
