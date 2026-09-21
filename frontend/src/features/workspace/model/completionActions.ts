import { needsReviewDecision } from '@/entities/execution-node/model/selectors'
import { reviewNodeClarification as requestNodeClarificationReview, reviewNodeCompletion as requestNodeCompletionReview } from '@/entities/execution-node/api/client'
import type { DraftReview } from '@/entities/execution-node/model/types'
import { createExecutionNode, confirmNodeCompletion as requestConfirmNodeCompletion, getProjectExecutionGraph } from '@/entities/project/api/client'
import { mergeProjectState, isCurrentContract } from './projectState'
import type { WorkspaceGet, WorkspaceSet } from './actionContext'
import type { WorkspaceState } from './dto'

const now = () => new Date().toISOString()

export function createCompletionActions(set: WorkspaceSet, get: WorkspaceGet): Pick<WorkspaceState, 'reviewNodeCompletion' | 'reviewNodeClarification' | 'confirmNodeCompletion' | 'createSupplementExecutionNode'> {
  return {
      reviewNodeCompletion: async (contractUuid, input) => {
        const state = get()
        const contract = state.contracts.find((item) => item.uuid === contractUuid)
        const project = state.projects.find((item) => item.uuid === contract?.projectUuid)
        if (
          !contract ||
          !project ||
          project.archivedAt ||
          contract.stage !== 'frozen' ||
          !isCurrentContract(project, contract, state.contracts, state.branches)
        ) {
          return { success: false, message: '当前节点不能提交审查。' }
        }
        if (!state.accessToken) {
          return { success: false, message: '请先登录，并为项目选择审查 AI。' }
        }

        try {
          await requestNodeCompletionReview(state.accessToken, contract, input)
          const snapshot = await getProjectExecutionGraph(state.accessToken, project.uuid)
          set((latestState) => mergeProjectState(latestState, snapshot))
          return { success: true }
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : 'AI 审查失败，请稍后重试。',
          }
        }
      },
      reviewNodeClarification: async (contractUuid, input) => {
        const state = get()
        const contract = state.contracts.find((item) => item.uuid === contractUuid)
        const project = state.projects.find((item) => item.uuid === contract?.projectUuid)
        const canReview = Boolean(contract && needsReviewDecision(contract))
        if (
          !contract ||
          !project ||
          project.archivedAt ||
          !contract.aiReview ||
          !canReview ||
          !isCurrentContract(project, contract, state.contracts, state.branches)
        ) {
          return { success: false, message: '当前节点不能补充审查说明。' }
        }
        if (!input.criterionIds.length || (input.explanation.trim().length < 4 && (input.evidenceAddition?.trim().length ?? 0) < 20)) {
          return {
            success: false,
            message: '请选择需复审的验收标准，并补充说明或提交前已存在的证据。',
          }
        }
        if (!state.accessToken) return { success: false, message: '请先登录，并为项目选择审查 AI。' }

        try {
          await requestNodeClarificationReview(state.accessToken, contract, input)
          const snapshot = await getProjectExecutionGraph(state.accessToken, project.uuid)
          set((latestState) => mergeProjectState(latestState, snapshot))
          return { success: true }
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : '补充审查失败，请稍后重试。',
          }
        }
      },
      confirmNodeCompletion: async (contractUuid) => {
        const source = get().contracts.find((contract) => contract.uuid === contractUuid)
        const project = get().projects.find((item) => item.uuid === source?.projectUuid)
        const canLockStage = Boolean(source && needsReviewDecision(source))
        if (
          !source ||
          !project ||
          project.archivedAt ||
          !isCurrentContract(project, source, get().contracts, get().branches) ||
          !canLockStage ||
          !source.aiReview
        ) {
          return { success: false, message: '当前节点不能锁定。' }
        }
        if (!get().accessToken) return { success: false, message: '请先登录后再锁定节点。' }
        try {
          const snapshot = await requestConfirmNodeCompletion(get().accessToken, project.uuid, source.uuid)
          set((state) => mergeProjectState(state, snapshot))
          return { success: true }
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : '锁定节点失败，请稍后重试。',
          }
        }
      },
      createSupplementExecutionNode: async (contractUuid) => {
        const source = get().contracts.find((contract) => contract.uuid === contractUuid)
        const project = get().projects.find((item) => item.uuid === source?.projectUuid)
        if (
          !source ||
          !project ||
          project.archivedAt ||
          !isCurrentContract(project, source, get().contracts, get().branches) ||
          source.stage !== 'needs_supplement' ||
          !source.aiReview?.suggestedSupplementTitle
        )
          return { success: false, message: '当前节点不能生成补足推进。' }
        const existing = get().contracts.find((contract) => contract.supplementOfContractUuid === source.uuid)
        if (existing) return { success: false, message: '这项节点已经有补足推进。' }
        if (!get().accessToken) return { success: false, message: '请先登录后再生成补足推进。' }

        const unmetCriteria = source.acceptanceCriteria.filter((criterion) =>
          source.aiReview?.criterionReviews.some((review) => review.criterionId === criterion.id && review.result !== 'met'),
        )
        const criteria = unmetCriteria.length > 0 ? unmetCriteria : source.acceptanceCriteria
        const title = source.aiReview.suggestedSupplementTitle
        const evidenceRequirement = '提交能直接补足上述冻结标准缺口的结果，并按 C1、C2… 逐条标明证据位置。'
        const draftReview: DraftReview = {
          uuid: crypto.randomUUID(),
          verdict: 'pass',
          summary: '补足推进由上一节点的 AI 审查缺口生成，继承原节点冻结的规则。',
          missingRequirements: [],
          createdAt: now(),
        }
        const originalIntent = `智能合约对原行为「${source.title}」的审查未通过。本补足行为只处理被标记的缺口。`
        try {
          const snapshot = await createExecutionNode(get().accessToken, {
              projectUuid: source.projectUuid,
              draft: originalIntent,
              draftReview,
              title,
              verifiableGoal: title,
              acceptanceCriteria: criteria.map((criterion, index) => ({
                ...criterion,
                id: `c${index + 1}`,
                requiredEvidence: `C${index + 1}：${criterion.requiredEvidence}`,
              })),
              evidenceRequirement,
              parentContractUuid: source.uuid,
              sourceContractUuids: [source.uuid],
              branchUuid: source.branchUuid,
              fork: false,
              supplementOfContractUuid: source.uuid,
          })
          set((state) => mergeProjectState(state, snapshot))
          return { success: true }
        } catch (error) {
          return {
            success: false,
            message: error instanceof Error ? error.message : '生成补足推进失败。',
          }
        }
      },

  }
}

