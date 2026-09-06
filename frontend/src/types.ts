export type ContractStage = 'task' | 'frozen' | 'verified' | 'needs_supplement' | 'completed'

export type ExecutionNodeKind = 'task' | 'progress'

export type SmartContractSource = 'official' | 'custom'

export type ReviewVerdict = 'pass' | 'partial' | 'fail'

export type ProjectVisibility = 'private' | 'public'

export type Gender = 'female' | 'male' | 'undisclosed'

export type Actor = {
  id: string
  name: string
  handle: string
  role: string
  bio?: string
  gender?: Gender
  avatarUrl?: string
}

export type ProjectContractRevision = {
  id: string
  smartContractId: string
  smartContractVersion: string
  reason: string
  activatedAt: string
}

export type Project = {
  id: string
  title: string
  description: string
  isDefault: boolean
  visibility: ProjectVisibility
  /** The sole behavior commitment this project is currently asking its owner to close. */
  currentContractId?: string | null
  activeContractRevisionId: string
  contractRevisions: ProjectContractRevision[]
  createdAt: string
  archivedAt?: string
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
}

export type DraftReview = {
  id: string
  verdict: 'pass' | 'fail'
  summary: string
  missingRequirements: string[]
  createdAt: string
}

export type UserVerdict = {
  result: 'confirmed_complete' | 'locked_with_ai_failure'
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
  reviewMessages: ReviewMessage[]
  aiReview?: AIReview
  userVerdict?: UserVerdict
  nextContractTitle?: string
  createdAt: string
  updatedAt: string
}

export type ExecutionEdge = {
  id: string
  sourceContractId: string
  targetContractId: string
  type: 'lineage' | 'fork' | 'supplement' | 'reference' | 'merge'
}
