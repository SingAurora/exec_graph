import type { ActionReference } from './references'

/** Identifies the author of the effective agreement rather than an inheriting node. */
export function getReferenceAgreementAuthorId(reference: ActionReference): string {
  const origin = reference.agreement.sourceNode
  return origin?.agreementSupplement?.authorId ?? origin?.authorId ?? reference.source.authorId
}

/** Lists explicitly satisfied interpersonal references, retaining each real arrow independently. */
export function getSatisfiedAgreementResponses(references: ActionReference[]): ActionReference[] {
  return references.filter((reference) => reference.agreementStatus === 'satisfied'
    && reference.agreement.markdown.trim()
    && !reference.sameAuthor
    && reference.target.authorId !== getReferenceAgreementAuthorId(reference))
    .sort((a, b) => Date.parse(b.target.createdAt) - Date.parse(a.target.createdAt)
      || b.target.number - a.target.number || a.id.localeCompare(b.id))
}
