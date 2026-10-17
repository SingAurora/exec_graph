import type { ActionNode } from '../model/types'
import { getActionParentIds } from './graph'

/** Read-only presentation of a real reference and its source-specific agreement assessment. */
export type ActionReference = {
  id: string
  source: ActionNode
  target: ActionNode
  sameAuthor: boolean
  incorporated: boolean
  agreementStatus: 'unrestricted' | 'satisfied' | 'exception' | 'unreviewed'
  exceptionReason?: string
  authorization: 'not-required' | 'self-approved' | 'author-approved' | 'pending'
}

/** Resolves direct graph links without inferring compliance from an author's free-text agreement. */
export function getActionReferences(actions: ActionNode[]): ActionReference[] {
  const byId = new Map(actions.map((node) => [node.id, node]))
  return actions.flatMap((target) => getActionParentIds(target).flatMap((sourceId): ActionReference[] => {
    const source = byId.get(sourceId)
    if (!source || source.projectId !== target.projectId) return []
    const assessment = target.referenceAgreements?.find((item) => item.sourceId === sourceId)
    const agreementStatus = !source.agreementMarkdown?.trim() ? 'unrestricted'
      : !assessment ? 'unreviewed' : assessment.complies ? 'satisfied' : 'exception'
    const sameAuthor = source.authorId === target.authorId
    const authorization = agreementStatus !== 'exception' ? 'not-required'
      : sameAuthor ? 'self-approved' : assessment?.approvedById === source.authorId ? 'author-approved' : 'pending'
    return [{ id: `${source.id}:${target.id}`, source, target, sameAuthor,
      incorporated: source.id !== target.parentId, agreementStatus, authorization,
      exceptionReason: assessment?.exceptionReason }]
  }))
}
