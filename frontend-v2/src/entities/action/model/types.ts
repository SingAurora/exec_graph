import type { ChatMessage, PostImage } from '../../../shared/model'

/** Records how one direct reference uses its source's agreement; approval does not remove an exception. */
export type ActionReferenceAgreement = {
  sourceId: string
  complies: boolean
  exceptionReason?: string
  approvedById?: string
}

/** A published account of something a user did; it has no goal or completion state. */
export type ActionNode = {
  id: string
  projectId: string
  number: number
  parentId?: string
  /** Additional action contexts incorporated alongside the primary continuation. */
  mergedParentIds?: string[]
  /** Optional conditions for using this action as context in a later action. */
  agreementMarkdown?: string
  /** Explicit agreement assessments for direct sources; absent assessments remain unknown. */
  referenceAgreements?: ActionReferenceAgreement[]
  authorId: string
  title: string
  markdown: string
  /** Facts from this action only. `markdown` remains as a legacy fallback. */
  objectiveMarkdown?: string
  /** Undefined inherits from parentId; an empty string explicitly clears the expression. */
  expressionMarkdown?: string
  /** Compact provenance captured when the two documents were generated. */
  contextSnapshot?: { directNodeIds: string[]; historyNodeCount: number; guide?: string }
  images: PostImage[]
  conversation: ChatMessage[]
  createdAt: string
}

/** Effective expression and the node that last updated or explicitly cleared it. */
export type ActionExpression = {
  markdown: string
  sourceNode?: ActionNode
}

/** The two independently readable documents attached to an action. */
export type ActionDocumentMode = 'objective' | 'expression'

/** The user's unpublished account and the conversation used to organize it. */
export type ActionDraft = {
  title: string
  markdown: string
  conversation: ChatMessage[]
}
