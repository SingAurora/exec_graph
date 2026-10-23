import type { ActionAgreement, ActionNode } from '../model/types'
import { getActionParentIds } from './graph'
import { getActionAgreements } from './agreements'

/** 一条真实引用箭头的展示模型：source 是被引用节点，target 是后续回应节点。 */
export type ActionReference = {
  id: string
  source: ActionNode
  target: ActionNode
  /** 决定同作者实线／跨作者虚线，与当前浏览者是谁无关。 */
  sameAuthor: boolean
  /** true 表示额外合入；false 表示主要承接，不能用实虚线区分这两种来源。 */
  incorporated: boolean
  agreement: ActionAgreement
  agreementStatus: 'unrestricted' | 'satisfied' | 'exception' | 'unreviewed'
  exceptionReason?: string
}

/** 从节点来源还原箭头，独立读取核对结果；有约定正文不代表本次引用已满足。 */
export function getActionReferences(actions: ActionNode[]): ActionReference[] {
  const byId = new Map(actions.map((node) => [node.id, node]))
  const agreements = getActionAgreements(actions)
  return actions.flatMap((target) => getActionParentIds(target).flatMap((sourceId): ActionReference[] => {
    const source = byId.get(sourceId)
    if (!source || source.projectId !== target.projectId) return []
    const assessment = target.referenceAgreements?.find((item) => item.sourceId === sourceId)
    const agreement = agreements.get(source.id)!
    // 四种状态分别是无约定、未核对、已满足和不满足；只有不满足显示叉号。
    const agreementStatus = !agreement.markdown.trim() ? 'unrestricted'
      : !assessment ? 'unreviewed' : assessment.complies ? 'satisfied' : 'exception'
    const sameAuthor = source.authorId === target.authorId
    return [{ id: `${source.id}:${target.id}`, source, target, sameAuthor,
      incorporated: source.id !== target.parentId, agreement, agreementStatus,
      exceptionReason: assessment?.exceptionReason }]
  }))
}

/** 本次各直接来源分别使用自己的有效约定，不把已被替换的祖先约定累计叠加。 */
export function getActionSourceAgreements(actions: ActionNode[], nodeId: string): ActionReference[] {
  return getActionReferences(actions).filter((reference) => reference.target.id === nodeId && reference.agreementStatus !== 'unrestricted')
}

/** 统计存在约定但尚未核对的直接引用。 */
export function getUnreviewedAgreementCount(references: ActionReference[]): number {
  return references.filter((reference) => reference.agreementStatus === 'unreviewed').length
}
