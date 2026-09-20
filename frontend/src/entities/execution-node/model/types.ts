export type ContractStage = 'frozen' | 'verified' | 'needs_supplement' | 'completed' | 'sealed'
export type CompletionRecordKind = 'accepted' | 'sealed'
export type ExecutionNodeKind = 'task' | 'progress'
export type ReviewVerdict = 'pass' | 'partial' | 'fail'

export type AIConfigSnapshot = { keyUuid: string; label: string; provider: string; model: string; baseUrl: string }
export type AcceptanceCriterion = { id: string; text: string; requiredEvidence: string }
export type CriterionReview = { criterionId: string; result: 'met' | 'unclear' | 'unmet'; reason: string }
export type ReviewMessage = { uuid: string; speaker: 'user' | 'ai'; body: string; createdAt: string }

export type AIReview = {
  uuid: string
  verdict: ReviewVerdict
  summary: string
  criterionReviews: CriterionReview[]
  suggestedSupplementTitle?: string
  createdAt: string
  aiConfig?: AIConfigSnapshot
}

export type ReviewClarification = {
  uuid: string
  criterionIds: string[]
  explanation: string
  evidenceReferences?: string
  evidenceAddition?: string
  evidencePredatesSubmission?: boolean
  createdAt: string
}

export type CompletionReviewRound = {
  uuid: string
  kind: 'initial' | 'clarification'
  clarification?: ReviewClarification
  review: AIReview
  aiConfig?: AIConfigSnapshot
  createdAt: string
}

export type DraftReview = { uuid: string; verdict: 'pass' | 'fail'; summary: string; missingRequirements: string[]; createdAt: string; aiConfig?: AIConfigSnapshot }
export type UserVerdict = { result: 'confirmed_complete' | 'sealed_with_ai_gap' | 'locked_with_ai_failure'; note: string; createdAt: string }

export type CompletionRecord = {
  uuid: string
  projectUuid: string
  closingContractUuid: string
  coveredContractUuids: string[]
  title: string
  summary: string
  smartContractUuid: string
  smartContractVersion: string
  reviewUuid: string
  aiReviewVerdict: ReviewVerdict
  recordKind: CompletionRecordKind
  userVerdict: UserVerdict
  createdAt: string
}

export type ExecutionBranch = {
  uuid: string
  projectUuid: string
  title: string
  rootContractUuid?: string
  forkedFromContractUuid?: string
  headContractUuid?: string | null
  currentContractUuid?: string | null
  createdByUserId?: string
  createdAt: string
}

export type ExecutionContract = {
  uuid: string
  projectUuid: string
  branchUuid?: string
  projectContractRevisionUuid: string
  parentContractUuid?: string
  sourceContractUuids?: string[]
  supplementOfContractUuid?: string
  retryOfContractUuid?: string
  actorUserId?: string
  title: string
  nodeKind?: ExecutionNodeKind
  stage: ContractStage
  originalIntent: string
  smartContractUuid: string
  smartContractVersion: string
  verifiableGoal: string
  acceptanceCriteria: AcceptanceCriterion[]
  evidenceRequirement: string
  completionClaim?: string
  evidenceText?: string
  startedAt?: string
  endedAt?: string
  completionRecordUuid?: string
  draftReview?: DraftReview
  draftReviewAIConfig?: AIConfigSnapshot
  reviewMessages: ReviewMessage[]
  aiReview?: AIReview
  completionReviewAIConfig?: AIConfigSnapshot
  completionReviewRounds?: CompletionReviewRound[]
  planningConversationUuid?: string
  completionConversationUuid?: string
  userVerdict?: UserVerdict
  nextContractTitle?: string
  createdAt: string
  updatedAt: string
}

export type ExecutionEdge = { uuid: string; sourceContractUuid: string; targetContractUuid: string; type: 'lineage' | 'fork' | 'supplement' | 'closure' | 'reference' | 'merge' }
