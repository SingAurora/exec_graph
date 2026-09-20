import type { Actor, CurrentUserProfileInput } from '@/entities/account/model/types'
import type { CreateExecutionNodeInput, ReviewClarificationInput, ReviewNodeDraftInput, SubmitCompletionInput } from '@/entities/execution-node/api/dto'
import type { CompletionRecord, DraftReview, ExecutionBranch, ExecutionContract, ExecutionEdge } from '@/entities/execution-node/model/types'
import type { CreateProjectInput, UpdateProjectProfileInput } from '@/entities/project/api/dto'
import type { Project } from '@/entities/project/model/types'
import type { CreateSmartContractInput } from '@/entities/smart-contract/api/client'
import type { SmartContractDefinition } from '@/entities/smart-contract/model/types'

export type {
  CreateExecutionNodeInput,
  CreateProjectInput,
  CreateSmartContractInput,
  ReviewClarificationInput,
  ReviewNodeDraftInput,
  SubmitCompletionInput,
  UpdateProjectProfileInput,
}

/** UI 操作完成后的统一局部结果。 */
export type ActionResult = { success: boolean; message?: string }
export type CreateExecutionNodeResult = { contractUuid?: string; draftReview: DraftReview }

/** 仅协调已登录用户工作区缓存的 Zustand 状态，不承载领域 API DTO。 */
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
  updateProjectProfile: (projectUuid: string, input: UpdateProjectProfileInput) => Promise<ActionResult>
  createSmartContract: (input: CreateSmartContractInput) => Promise<string | null>
  deleteSmartContract: (contractUuid: string) => Promise<ActionResult>
  setProjectSmartContract: (projectUuid: string, smartContractUuid: string) => Promise<ActionResult>
  archiveProject: (projectUuid: string) => Promise<ActionResult>
  restoreArchivedProject: (projectUuid: string) => Promise<ActionResult>
  deleteProject: (projectUuid: string) => Promise<ActionResult>
  reviewNodeDraft: (input: ReviewNodeDraftInput) => Promise<CreateExecutionNodeResult>
  createExecutionNode: (input: CreateExecutionNodeInput) => Promise<CreateExecutionNodeResult>
  reviewNodeCompletion: (contractUuid: string, input: SubmitCompletionInput) => Promise<ActionResult>
  reviewNodeClarification: (contractUuid: string, input: ReviewClarificationInput) => Promise<ActionResult>
  confirmNodeCompletion: (contractUuid: string) => Promise<ActionResult>
  createSupplementExecutionNode: (contractUuid: string) => Promise<ActionResult>
  setAccessToken: (token: string) => void
  refreshWorkspace: () => Promise<ActionResult>
  signOut: () => void
  updateProfile: (input: CurrentUserProfileInput) => void
  updateAccountEmail: (email: string) => ActionResult
  updateAccountPassword: () => ActionResult
}
