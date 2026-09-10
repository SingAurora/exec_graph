export type ContractStage = 'frozen' | 'verified' | 'needs_supplement' | 'completed' | 'sealed'

export type CompletionRecordKind = 'accepted' | 'sealed'

export type ExecutionNodeKind = 'task' | 'progress'

export type SmartContractSource = 'official' | 'custom'

export type ReviewVerdict = 'pass' | 'partial' | 'fail'

export type ProjectVisibility = 'private' | 'public'

export type ProjectType = 'guided' | 'autonomous'

export type Gender = 'female' | 'male' | 'undisclosed'

export type Actor = {
  id: string
  name: string
  handle: string
  role: string
  bio?: string
  gender?: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
}

export type ProjectContractRevision = {
  id: string
  smartContractId: string
  smartContractVersion: string
  reason: string
  activatedAt: string
  smartContract?: SmartContractDefinition
}

export type Project = {
  id: string
  title: string
  description: string
  isDefault: boolean
  visibility: ProjectVisibility
  /** Fixed at creation time so a project's execution semantics stay consistent. */
  projectType: ProjectType
  /** User-authored project rules consumed by guided action-contract generation. */
  projectRules: string
  reviewAIKeyId?: string
  /** The sole behavior commitment this project is currently asking its owner to close. */
  currentContractId?: string | null
  activeContractRevisionId: string
  contractRevisions: ProjectContractRevision[]
  createdAt: string
  archivedAt?: string
}

export type AIConfigSnapshot = {
  keyId: string
  label: string
  provider: string
  model: string
  baseUrl: string
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

export type SmartContractDefinition = {
  id: string
  name: string
  source: SmartContractSource
  version: string
  description: string
  /** The single Markdown document that defines deployment and review behavior. */
  body: string
}

export type AcceptanceCriterion = {
  id: string
  text: string
  requiredEvidence: string
}

export type CriterionReview = {
  criterionId: string
  result: 'met' | 'unclear' | 'unmet'
  reason: string
}

export type ReviewMessage = {
  id: string
  speaker: 'user' | 'ai'
  body: string
  createdAt: string
}

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
  createdAt: string
}

/** One immutable AI judgment over the original submission and, optionally, a clarification. */
export type CompletionReviewRound = {
  id: string
  kind: 'initial' | 'clarification'
  clarification?: ReviewClarification
  review: AIReview
  aiConfig?: AIConfigSnapshot
  createdAt: string
}

export type DraftReview = {
  id: string
  verdict: 'pass' | 'fail'
  summary: string
  missingRequirements: string[]
  createdAt: string
  aiConfig?: AIConfigSnapshot
}

export type UserVerdict = {
  result: 'confirmed_complete' | 'sealed_with_ai_gap' | 'locked_with_ai_failure'
  note: string
  createdAt: string
}

/** A signed result that closes one or more action nodes as a single stage. */
export type CompletionRecord = {
  id: string
  projectId: string
  closingContractId: string
  coveredContractIds: string[]
  title: string
  summary: string
  smartContractId: string
  smartContractVersion: string
  ruleHash: string
  reviewId: string
  aiReviewVerdict: ReviewVerdict
  recordKind: CompletionRecordKind
  userVerdict: UserVerdict
  createdAt: string
}

export type ExecutionContract = {
  id: string
  projectId: string
  branchId?: string
  projectContractRevisionId: string
  parentContractId?: string
  /** Earlier action nodes this behavior relies on; multiple sources describe a convergence action. */
  sourceContractIds?: string[]
  supplementOfContractId?: string
  actorId?: string
  title: string
  nodeKind?: ExecutionNodeKind
  stage: ContractStage
  originalIntent: string
  smartContractId: string
  smartContractVersion: string
  ruleHash: string
  verifiableGoal: string
  acceptanceCriteria: AcceptanceCriterion[]
  evidenceRequirement: string
  completionClaim?: string
  evidenceText?: string
  /** The immutable completion record that covers this action, if any. */
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

export type ExecutionEdge = {
  id: string
  sourceContractId: string
  targetContractId: string
  type: 'lineage' | 'fork' | 'supplement' | 'closure' | 'reference' | 'merge'
}
