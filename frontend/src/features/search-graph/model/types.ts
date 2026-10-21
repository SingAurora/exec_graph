/** Independently searchable content categories within one graph. */
export type GraphSearchScope = 'expressions' | 'agreements' | 'actions' | 'users'

/** Draft or submitted conditions; each category uses only its relevant author fields. */
export type GraphSearchCriteria = {
  keyword: string
  authorId?: string
  participantId?: string
  otherParticipantId?: string
}
