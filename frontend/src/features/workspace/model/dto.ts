import type { Actor, Gender } from '@/entities/account/model/types'
import type {
  CompletionRecord,
  DraftReview,
  ExecutionBranch,
  ExecutionContract,
  ExecutionEdge,
  AIReview,
} from '@/entities/execution-node/model/types'
import type { Project, ProjectType } from '@/entities/project/model/types'
import type { SmartContractDefinition } from '@/entities/smart-contract/model/types'

export type SubmitCompletionInput = {
  completionClaim: string
  evidenceText: string
  startedAt?: string
  endedAt?: string
}

export type ReviewClarificationInput = {
  criterionIds: string[]
  explanation: string
  evidenceReferences?: string
  evidenceAddition?: string
  evidencePredatesSubmission?: boolean
}

export type CreateContractInput = {
  projectId: string
  draft: string
  parentContractId?: string
  sourceContractIds?: string[]
  branchId?: string
  fork?: boolean
  closureSourceIds?: string[]
  supplementOfContractId?: string
  retryOfContractId?: string
  draftReview?: DraftReview
  planningConversationId?: string
}

export type ReviewNodeDraftInput = { projectId: string; draft: string }

export type CreateProjectInput = {
  title: string
  description: string
  projectType: ProjectType
  projectRules: string
  smartContractId: string
  visibility: 'private' | 'public'
  aiKeyId: string
  contributionCallId?: string
}

export type UpdateProjectInput = { title: string; description: string; visibility: 'private' | 'public' }
export type CreateSmartContractInput = { name: string; description: string; body: string }
export type CreateContractResult = { contractId?: string; draftReview: DraftReview }
export type AuthResult = { success: boolean; message?: string }

export type ProfileInput = {
  username: string
  userId: string
  bio: string
  gender: Gender
  avatarUrl?: string
  profileBackgroundUrl?: string
  customProfileEnabled?: boolean
  customProfileMarkdown?: string
}

export type ProjectStateResponse = {
  project: Project
  nodes: ExecutionContract[]
  edges: ExecutionEdge[]
  branches: ExecutionBranch[]
  completionRecords: CompletionRecord[]
}

export type WorkspaceState = {
  actors: Actor[]
  currentActorId: string
  isAuthenticated: boolean
  accessToken: string
  accountEmail: string
  projects: Project[]
  smartContracts: SmartContractDefinition[]
  branches: ExecutionBranch[]
  contracts: ExecutionContract[]
  completionRecords: CompletionRecord[]
  edges: ExecutionEdge[]
  createProject: (input: CreateProjectInput) => Promise<string | null>
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<AuthResult>
  createSmartContract: (input: CreateSmartContractInput) => Promise<string | null>
  deleteSmartContract: (contractId: string) => Promise<AuthResult>
  upgradeProjectContract: (projectId: string, smartContractId: string) => Promise<AuthResult>
  archiveProject: (projectId: string) => Promise<AuthResult>
  restoreProject: (projectId: string) => Promise<AuthResult>
  deleteProject: (projectId: string) => Promise<AuthResult>
  reviewNodeDraft: (input: ReviewNodeDraftInput) => Promise<CreateContractResult>
  createContract: (input: CreateContractInput) => Promise<CreateContractResult>
  submitCompletion: (contractId: string, input: SubmitCompletionInput) => Promise<AuthResult>
  submitReviewClarification: (contractId: string, input: ReviewClarificationInput) => Promise<AuthResult>
  confirmCompletion: (contractId: string) => Promise<AuthResult>
  createSupplementContract: (contractId: string) => Promise<AuthResult>
  setAccessToken: (token: string) => void
  refreshWorkspace: () => Promise<AuthResult>
  signOut: () => void
  updateProfile: (input: ProfileInput) => void
  updateAccountEmail: (email: string) => AuthResult
  updateAccountPassword: () => AuthResult
}

export type WorkspaceReviewResult = { review?: AIReview }
