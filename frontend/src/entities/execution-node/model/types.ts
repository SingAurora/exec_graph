export type ContractStage = 'frozen' | 'verified' | 'needs_supplement' | 'completed' | 'sealed'
export type CompletionRecordKind = 'accepted' | 'sealed'
export type ExecutionNodeKind = 'task' | 'progress'
export type ReviewVerdict = 'pass' | 'partial' | 'fail'

export type AIConfigSnapshot = { keyId: string; label: string; provider: string; model: string; baseUrl: string }
export type AcceptanceCriterion = { id: string; text: string; requiredEvidence: string }
export type CriterionReview = { criterionId: string; result: 'met' | 'unclear' | 'unmet'; reason: string }
export type ReviewMessage = { id: string; speaker: 'user' | 'ai'; body: string; createdAt: string }

export type AIReview = {
  id: string
  verdict: ReviewVerdict
  summary: string
  criterionReviews: CriterionReview[]
  suggestedSupplementTitle?: string
  createdAt: string
  aiConfig?: AIConfigSnapshot
}

export type ReviewClarification = {
  id: string
  criterionIds: string[]
  explanation: string
  evidenceReferences?: string
  evidenceAddition?: string
  evidencePredatesSubmission?: boolean
  createdAt: string
}

export type CompletionReviewRound = {
  id: string
  kind: 'initial' | 'clarification'
  clarification?: ReviewClarification
  review: AIReview
  aiConfig?: AIConfigSnapshot
  createdAt: string
}

export type DraftReview = { id: string; verdict: 'pass' | 'fail'; summary: string; missingRequirements: string[]; createdAt: string; aiConfig?: AIConfigSnapshot }
export type UserVerdict = { result: 'confirmed_complete' | 'sealed_with_ai_gap' | 'locked_with_ai_failure'; note: string; createdAt: string }

export type CompletionRecord = {
  id: string
  projectId: string
  closingContractId: string
  coveredContractIds: string[]
  title: string
  summary: string
  smartContractId: string
  smartContractVersion: string
  reviewId: string
  aiReviewVerdict: ReviewVerdict
  recordKind: CompletionRecordKind
  userVerdict: UserVerdict
  createdAt: string
}

export type ExecutionBranch = {
  id: string
  projectId: string
  title: string
  rootContractId?: string
  forkedFromContractId?: string
  headContractId?: string | null
  currentContractId?: string | null
  createdById?: string
  createdAt: string
}

export type ExecutionContract = {
  id: string
  projectId: string
  branchId?: string
  projectContractRevisionId: string
  parentContractId?: string
  sourceContractIds?: string[]
  supplementOfContractId?: string
  retryOfContractId?: string
  actorId?: string
  title: string
  nodeKind?: ExecutionNodeKind
  stage: ContractStage
  originalIntent: string
  smartContractId: string
  smartContractVersion: string
  verifiableGoal: string
  acceptanceCriteria: AcceptanceCriterion[]
  evidenceRequirement: string
  completionClaim?: string
  evidenceText?: string
  startedAt?: string
  endedAt?: string
  completionRecordId?: string
  draftReview?: DraftReview
  draftReviewAIConfig?: AIConfigSnapshot
  reviewMessages: ReviewMessage[]
  aiReview?: AIReview
  completionReviewAIConfig?: AIConfigSnapshot
  completionReviewRounds?: CompletionReviewRound[]
  planningConversationId?: string
  completionConversationId?: string
  userVerdict?: UserVerdict
  nextContractTitle?: string
  createdAt: string
  updatedAt: string
}

export type ExecutionEdge = { id: string; sourceContractId: string; targetContractId: string; type: 'lineage' | 'fork' | 'supplement' | 'closure' | 'reference' | 'merge' }
