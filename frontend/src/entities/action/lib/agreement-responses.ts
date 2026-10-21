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

/** Lists a person's satisfied exchanges as responder or actual agreement author, once per arrow. */
export function getProfileAgreementResponses(references: ActionReference[], userId: string): ActionReference[] {
  return getSatisfiedAgreementResponses(references).filter((reference) => reference.target.authorId === userId
    || getReferenceAgreementAuthorId(reference) === userId)
}

/** Filters supplied exchanges by one or two participants in either direction, retaining their order. */
export function filterAgreementParticipants(references: ActionReference[], participantId?: string, otherParticipantId?: string): ActionReference[] {
  if (!participantId && !otherParticipantId) return references
  if (participantId && participantId === otherParticipantId) return []
  return references.filter((reference) => {
    const participants = [reference.target.authorId, getReferenceAgreementAuthorId(reference)]
    return (!participantId || participants.includes(participantId))
      && (!otherParticipantId || participants.includes(otherParticipantId))
  })
}
