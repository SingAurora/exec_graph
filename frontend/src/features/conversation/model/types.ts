import type { AIConfigSnapshot } from '@/entities/execution-node/model/types'

export type ActionDraft = {
  title: string
  verifiableGoal: string
  acceptanceCriteria: string[]
  evidenceRequirement: string
}

export type CompletionProgressItem = { criterionId: string; status: 'confirmed' | 'unclear' | 'notMentioned' | 'notCompleted'; reason: string }
export type CompletionProgress = {
  confirmed: CompletionProgressItem[]
  unclear: CompletionProgressItem[]
  notMentioned: CompletionProgressItem[]
  notCompleted: CompletionProgressItem[]
}
export type PlanningReview = { verdict: 'pass' | 'fail'; summary: string; missingRequirements: string[] }

export type ConversationMessage = { uuid: string; role: 'user' | 'assistant'; body: string; structuredPayload?: unknown; createdAt: string }

/** AI 协助制定或验收一项行动的服务端会话。 */
export type ActionConversation = {
  uuid: string
  phase: 'planning' | 'completion'
  status: string
  currentDraft?: ActionDraft
  currentDraftReview?: PlanningReview
  currentProgress?: CompletionProgress
  context?: { smartContract?: { uuid?: string } }
  aiConfig?: AIConfigSnapshot
  messages: ConversationMessage[]
  updatedAt: string
}

export type FinalizeCompletionReviewInput = {
  conversationUuid: string
  startedAt?: string
  endedAt?: string
}

export type OpenPlanningConversationInput = {
  projectUuid: string
  parentContractUuid?: string
  sourceContractUuids?: string[]
  branchUuid?: string
  fork?: boolean
  closureSourceUuids?: string[]
  supplementOfContractUuid?: string
  retryOfContractUuid?: string
}
