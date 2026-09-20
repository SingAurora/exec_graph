import type { AIReview, DraftReview } from '../model/types'

/** 新建推进节点时由前端提交的冻结草案。 */
export type CreateExecutionNodeInput = {
  projectUuid: string
  draft: string
  parentContractUuid?: string
  sourceContractUuids?: string[]
  branchUuid?: string
  fork?: boolean
  closure?: boolean
  closureSourceUuids?: string[]
  supplementOfContractUuid?: string
  retryOfContractUuid?: string
  draftReview?: DraftReview
  planningConversationUuid?: string
}

export type ReviewNodeDraftInput = { projectUuid: string; draft: string }
export type SubmitCompletionInput = { completionClaim: string; evidenceText: string; startedAt?: string; endedAt?: string }
export type ReviewClarificationInput = { criterionIds: string[]; explanation: string; evidenceReferences?: string; evidenceAddition?: string; evidencePredatesSubmission?: boolean }
export type NodeDraftReviewResult = { review?: DraftReview }
export type NodeCompletionReviewResult = { review?: AIReview }
