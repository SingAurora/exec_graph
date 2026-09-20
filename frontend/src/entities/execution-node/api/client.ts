import { postJSON } from '@/shared/api/client'
import type { Project } from '@/entities/project/model/types'
import type { SmartContractDefinition } from '@/entities/smart-contract/model/types'
import type { AIReview, DraftReview, ExecutionContract } from '../model/types'
import type { NodeCompletionReviewResult, NodeDraftReviewResult, ReviewClarificationInput, SubmitCompletionInput } from './dto'

export async function reviewNodeDraft(
  accessToken: string,
  project: Project,
  smartContract: SmartContractDefinition,
  draft: string,
  compiled: { title: string; verifiableGoal: string; acceptanceCriteria: string[]; evidenceRequirement: string },
): Promise<DraftReview> {
  const data = await postJSON<NodeDraftReviewResult>(
    '/api/commands/reviews/review-node-draft',
    {
      project: { uuid: project.uuid, title: project.title, description: project.description, projectType: project.projectType, projectRules: project.projectRules },
      smartContract: { uuid: smartContract.uuid, name: smartContract.name, description: smartContract.description, body: smartContract.body },
      draft: draft.trim(),
      ...compiled,
    },
    accessToken,
  )
  if (!data.review) throw new Error('节点草案审核没有返回结果。')
  return data.review
}

export async function reviewNodeCompletion(accessToken: string, contract: ExecutionContract, input: SubmitCompletionInput): Promise<AIReview> {
  const data = await postJSON<NodeCompletionReviewResult>('/api/commands/reviews/review-node-completion', {
    nodeUuid: contract.uuid,
    completionClaim: input.completionClaim.trim(),
    evidenceText: input.evidenceText.trim(),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  }, accessToken)
  if (!data.review) throw new Error('AI 审查没有返回结果。')
  return data.review
}

export async function reviewNodeClarification(accessToken: string, contract: ExecutionContract, input: ReviewClarificationInput): Promise<AIReview> {
  const data = await postJSON<NodeCompletionReviewResult>('/api/commands/reviews/review-node-clarification', {
    nodeUuid: contract.uuid,
    criterionIds: input.criterionIds,
    explanation: input.explanation.trim(),
    evidenceReferences: input.evidenceReferences?.trim() ?? '',
    evidenceAddition: input.evidenceAddition?.trim() ?? '',
    evidencePredatesSubmission: input.evidencePredatesSubmission ?? false,
  }, accessToken)
  if (!data.review) throw new Error('补充审查没有返回结果。')
  return data.review
}
