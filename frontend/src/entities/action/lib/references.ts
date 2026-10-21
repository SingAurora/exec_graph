import type { ActionAgreement, ActionNode } from '../model/types'
import { getActionParentIds } from './graph'
import { getActionAgreements } from './agreements'

/** Read-only presentation of a real reference and its source-specific agreement assessment. */
export type ActionReference = {
  id: string
  source: ActionNode
  target: ActionNode
  sameAuthor: boolean
  incorporated: boolean
  agreement: ActionAgreement
  agreementStatus: 'unrestricted' | 'satisfied' | 'exception' | 'unreviewed'
  exceptionReason?: string
}

/** Resolves direct graph links without inferring compliance from an author's free-text agreement. */
export function getActionReferences(actions: ActionNode[]): ActionReference[] {
  const byId = new Map(actions.map((node) => [node.id, node]))
  const agreements = getActionAgreements(actions)
  return actions.flatMap((target) => getActionParentIds(target).flatMap((sourceId): ActionReference[] => {
    const source = byId.get(sourceId)
    if (!source || source.projectId !== target.projectId) return []
    const assessment = target.referenceAgreements?.find((item) => item.sourceId === sourceId)
    const agreement = agreements.get(source.id)!
    const agreementStatus = !agreement.markdown.trim() ? 'unrestricted'
      : !assessment ? 'unreviewed' : assessment.complies ? 'satisfied' : 'exception'
    const sameAuthor = source.authorId === target.authorId
    return [{ id: `${source.id}:${target.id}`, source, target, sameAuthor,
      incorporated: source.id !== target.parentId, agreement, agreementStatus,
      exceptionReason: assessment?.exceptionReason }]
  }))
}

/** Lists each direct source's effective agreement without accumulating superseded ancestor versions. */
export function getActionSourceAgreements(actions: ActionNode[], nodeId: string): ActionReference[] {
  return getActionReferences(actions).filter((reference) => reference.target.id === nodeId && reference.agreementStatus !== 'unrestricted')
}

/** Counts source agreements whose compliance has not been assessed. */
export function getUnreviewedAgreementCount(references: ActionReference[]): number {
  return references.filter((reference) => reference.agreementStatus === 'unreviewed').length
}
