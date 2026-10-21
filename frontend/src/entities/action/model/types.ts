import type { ChatMessage, PostImage } from '../../../shared/model/content'

/** Continuation mode retained by the prototype's action entry callbacks. */
export type BranchMode = 'continue' | 'fork'

/** Latest edit after publication; older records without a kind represent manual supplements. */
export type ActionDocumentRevision = {
  authorId: string
  createdAt: string
  kind?: 'supplement' | 'modify' | 'clear'
}

/** A continued expression turn retains the participant who contributed it. */
export type ActionExpressionMessage = ChatMessage & { authorId?: string }

/** Records whether one direct reference complies with its source's agreement. */
export type ActionReferenceAgreement = {
  sourceId: string
  complies: boolean
  exceptionReason?: string
}

/** A published account of something a user did; it has no goal or completion state. */
export type ActionNode = {
  id: string
  projectId: string
  number: number
  parentId?: string
  /** Additional action contexts incorporated alongside the primary continuation. */
  mergedParentIds?: string[]
  /** Undefined inherits from parentId; an empty string explicitly clears downstream conditions. */
  agreementMarkdown?: string
  /** Latest manual edit, kept separate from the original conversation. */
  agreementSupplement?: ActionDocumentRevision
  /** Explicit agreement assessments for direct sources; absent assessments remain unknown. */
  referenceAgreements?: ActionReferenceAgreement[]
  authorId: string
  title: string
  markdown: string
  /** Facts from this action only. `markdown` remains as a legacy fallback. */
  objectiveMarkdown?: string
  /** Undefined inherits from parentId; an empty string explicitly clears the expression. */
  expressionMarkdown?: string
  /** Latest expression revision metadata; dialogue continues the original conversation. */
  expressionSupplement?: ActionDocumentRevision
  /** Additional expression dialogue, continuing the original action conversation without rewriting it. */
  expressionConversation?: ActionExpressionMessage[]
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

/** Known facts for revising an expression: only this node and its cited history. */
export type ActionExpressionContext = {
  nodeNumber: number
  facts: { number: number; authorId: string; title: string; markdown: string }[]
}

/** Effective downstream conditions and the node that last set or cleared them. */
export type ActionAgreement = {
  markdown: string
  sourceNode?: ActionNode
}

/** One direct source of an unpublished action, with its effective agreement. */
export type ActionContinuationSource = {
  node: ActionNode
  kind: 'primary' | 'merged'
  agreement: ActionAgreement
}

/** Identifies the actual agreement version inherited or revised by a node. */
export type ActionAgreementOrigin = {
  kind: 'modified' | 'inherited'
  node: ActionNode
}

/** Identifies the actual expression document inherited or revised by a node. */
export type ActionExpressionOrigin = {
  kind: 'modified' | 'inherited'
  node: ActionNode
}

/** How the node treats expression, including empty states omitted from public reading controls. */
export type ActionExpressionChange = {
  kind: 'initial' | 'modified' | 'inherited' | 'cleared' | 'empty'
  source?: ActionNode
}

/** The two independently readable documents attached to an action. */
export type ActionDocumentMode = 'objective' | 'expression'

/** The three author choices for a document passed along a continuation. */
export type ActionDocumentUpdateMode = 'inherit' | 'update' | 'clear'

/** The user's unpublished account and the conversation used to organize it. */
export type ActionDraft = {
  title: string
  markdown: string
  conversation: ChatMessage[]
}
