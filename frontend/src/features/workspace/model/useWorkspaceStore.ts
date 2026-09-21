import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CompletionRecord, ExecutionBranch, ExecutionContract, ExecutionEdge } from '@/entities/execution-node/model/types'
import type { Actor } from '@/entities/account/model/types'
import type { Project } from '@/entities/project/model/types'
import type { SmartContractDefinition } from '@/entities/smart-contract/model/types'
import { reviewNodeDraft as requestNodeDraftReview } from '@/entities/execution-node/api/client'
import { createExecutionNode } from '@/entities/project/api/client'
import type { WorkspaceState } from './dto'
import { buildDraftReview } from './draftReview'
import {
  currentContractForBranch,
  currentContractForProject,
  currentRevision,
  isCurrentContract,
  mergeProjectState,
} from './projectState'
import { createProjectActions } from './projectActions'
import { createSmartContractActions } from './smartContractActions'
import { createCompletionActions } from './completionActions'
import { createSessionActions } from './sessionActions'

const now = () => new Date().toISOString()

const initialState: Pick<WorkspaceState, 'actors' | 'currentActorId' | 'isAuthenticated' | 'accessToken' | 'accountEmail' | 'projects' | 'smartContracts' | 'branches' | 'contracts' | 'completionRecords' | 'edges'> = {
  actors: [] as Actor[],
  currentActorId: '',
  isAuthenticated: false,
  accessToken: '',
  accountEmail: '',
  projects: [] as Project[],
  smartContracts: [] as SmartContractDefinition[],
  branches: [] as ExecutionBranch[],
  contracts: [] as ExecutionContract[],
  completionRecords: [] as CompletionRecord[],
  edges: [] as ExecutionEdge[],
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      ...initialState,
      ...createSmartContractActions(set, get),
      ...createProjectActions(set, get),
      reviewNodeDraft: async (input) => {
        const project = get().projects.find((item) => item.uuid === input.projectUuid)
        if (!project) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '找不到项目，不能审核节点草案。',
              missingRequirements: ['请选择一个存在的项目。'],
              createdAt: now(),
            },
          }
        }
        if (project.archivedAt) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '项目已归档，不能审核新的推进节点。',
              missingRequirements: ['归档项目仅保留查看和追溯功能。'],
              createdAt: now(),
            },
          }
        }
        const localReview = buildDraftReview(input.draft)
        if (localReview.review.verdict === 'fail') return { draftReview: localReview.review }
        if (!get().accessToken) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '节点草案需要 AI 审核后才能创建。',
              missingRequirements: ['请先登录，并为项目选择审查 AI。'],
              createdAt: now(),
            },
          }
        }
        const projectRevision = currentRevision(project)
        const smartContract = get().smartContracts.find((item) => item.uuid === projectRevision.smartContractUuid) ?? get().smartContracts[0]
        if (!smartContract) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '找不到平台基础审查规则，不能审核节点草案。',
              missingRequirements: ['请检查后端的基础审查规则配置。'],
              createdAt: now(),
            },
          }
        }
        try {
          const draftReview = await requestNodeDraftReview(get().accessToken, project, smartContract, input.draft, localReview.compiled)
          return { draftReview }
        } catch (error) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: error instanceof Error ? error.message : '节点草案审核失败，请稍后重试。',
              missingRequirements: ['请检查项目审查 AI、模型和后端服务。'],
              createdAt: now(),
            },
          }
        }
      },
      createExecutionNode: async (input) => {
        const project = get().projects.find((item) => item.uuid === input.projectUuid)
        if (!project) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '找不到项目，不能在没有项目合约的情况下开始行为。',
              missingRequirements: ['请选择一个存在的项目。'],
              createdAt: now(),
            },
          }
        }
        if (project.archivedAt) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '项目已归档，不能再开始或继续行为。',
              missingRequirements: ['归档项目仅保留查看和追溯功能。'],
              createdAt: now(),
            },
          }
        }

        const allContracts = get().contracts
        const projectContracts = allContracts.filter((contract) => contract.projectUuid === project.uuid)
        const sourceIds = [...new Set(input.sourceContractUuids?.length ? input.sourceContractUuids : input.parentContractUuid ? [input.parentContractUuid] : [])]
        const sourceContracts = sourceIds
          .map((sourceId) => allContracts.find((contract) => contract.uuid === sourceId))
          .filter((contract): contract is ExecutionContract => Boolean(contract))
        const parentContract = sourceContracts[0]
        const isConvergence = sourceIds.length > 1
        const isClosure = input.closureSourceUuids?.length === 1 && input.closureSourceUuids[0] === sourceIds[0] && sourceIds.length === 1
        const isClosureSource =
          isClosure && Boolean(parentContract) && parentContract?.stage === 'frozen' && isCurrentContract(project, parentContract, allContracts, get().branches)
        const isSupplement = Boolean(input.supplementOfContractUuid) && input.supplementOfContractUuid === sourceIds[0] && sourceIds.length === 1
        const isSupplementSource =
          isSupplement &&
          Boolean(parentContract) &&
          parentContract?.stage === 'needs_supplement' &&
          isCurrentContract(project, parentContract, allContracts, get().branches)
        const isReplacementSource = isClosureSource || isSupplementSource
        const invalidSources =
          sourceContracts.length !== sourceIds.length ||
          sourceContracts.some(
            (contract) => contract.projectUuid !== project.uuid || (!isReplacementSource && (contract.stage !== 'completed' || !contract.completionRecordUuid)),
          )
        if (invalidSources) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: isConvergence
                ? '不能开始汇合行动。只有同一项目中已经被完成记录锁定的节点，才能作为多个来源。'
                : '接续来源不可用。行为承诺只能从同一项目已签名完成的记录开始。',
              missingRequirements: isConvergence ? ['请至少选择两条已纳入完成记录的节点，再开始一项普通行动。'] : ['请从已完成记录选择“继续”或“拆分新路径”。'],
              createdAt: now(),
            },
          }
        }

        let selectedBranch: ExecutionBranch | undefined
        let shouldCreateBranch = false
        if (isConvergence) {
          const hasCurrentProjectContract = currentContractForProject(project, allContracts)
          const hasCurrentBranchContract = get().branches.some((branch) => branch.projectUuid === project.uuid && currentContractForBranch(branch, allContracts))
          if (hasCurrentProjectContract || hasCurrentBranchContract) {
            return {
              draftReview: {
                uuid: crypto.randomUUID(),
                verdict: 'fail',
                summary: '还有行为承诺尚未结算，暂时不能发起合并。',
                missingRequirements: ['先完成当前行为承诺，再把已通过的分支成果提交给合并审查。'],
                createdAt: now(),
              },
            }
          }
        } else if (project.visibility === 'private') {
          if (currentContractForProject(project, allContracts) && !isReplacementSource) {
            return {
              draftReview: {
                uuid: crypto.randomUUID(),
                verdict: 'fail',
                summary: '当前还有一项行为承诺尚未结算，不能同时开始新的行为承诺。',
                missingRequirements: ['请先提交证明、确认完成，或处理 AI 标出的证据缺口。'],
                createdAt: now(),
              },
            }
          }
          const selectedPrivateBranch = input.branchUuid
            ? get().branches.find((branch) => branch.uuid === input.branchUuid && branch.projectUuid === project.uuid)
            : undefined
          if (input.branchUuid && (!selectedPrivateBranch || !parentContract || selectedPrivateBranch.headContractUuid !== parentContract.uuid)) {
            return {
              draftReview: {
                uuid: crypto.randomUUID(),
                verdict: 'fail',
                summary: '这条行为路径已经不是可继续的末端。',
                missingRequirements: ['请从该路径最新的已完成记录继续，或从完成记录拆分新路径。'],
                createdAt: now(),
              },
            }
          }
          if (selectedPrivateBranch) {
            selectedBranch = selectedPrivateBranch
            if (currentContractForBranch(selectedPrivateBranch, allContracts) && !isReplacementSource) {
              return {
                draftReview: {
                  uuid: crypto.randomUUID(),
                  verdict: 'fail',
                  summary: '这条行为路径还有一项承诺尚未结算。',
                  missingRequirements: ['请先结算这条路径当前的行为承诺。'],
                  createdAt: now(),
                },
              }
            }
          } else if (input.fork) {
            shouldCreateBranch = true
          } else {
            const latestCompleted = projectContracts
              .filter((contract) => contract.stage === 'completed')
              .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
            if (projectContracts.length > 0 && !parentContract && !input.retryOfContractUuid) {
              return {
                draftReview: {
                  uuid: crypto.randomUUID(),
                  verdict: 'fail',
                  summary: '继续行为必须从一条已完成记录开始。',
                  missingRequirements: ['打开完成记录，选择“继续下一项”或“拆分新路径”。'],
                  createdAt: now(),
                },
              }
            }
            if (!isReplacementSource && parentContract && latestCompleted?.uuid !== parentContract.uuid) {
              return {
                draftReview: {
                  uuid: crypto.randomUUID(),
                  verdict: 'fail',
                  summary: '主线只能从最近一条已完成记录继续。',
                  missingRequirements: ['从最新完成记录继续，或明确选择“拆分新路径”。'],
                  createdAt: now(),
                },
              }
            }
          }
          if (input.fork && !selectedPrivateBranch) {
            shouldCreateBranch = true
          }
        } else {
          if (projectContracts.length > 0 && !parentContract && !input.retryOfContractUuid) {
            return {
              draftReview: {
                uuid: crypto.randomUUID(),
                verdict: 'fail',
                summary: '公开项目的新行为必须从一条已完成记录开始。',
                missingRequirements: ['打开完成记录，选择在路径上继续或拆分新路径。'],
                createdAt: now(),
              },
            }
          }
          if (input.branchUuid) {
            selectedBranch = get().branches.find((branch) => branch.uuid === input.branchUuid && branch.projectUuid === project.uuid)
            if (!selectedBranch) {
              return {
                draftReview: {
                  uuid: crypto.randomUUID(),
                  verdict: 'fail',
                  summary: '找不到要继续的行为路径。',
                  missingRequirements: ['请从公开项目中的已完成记录发起继续或拆分。'],
                  createdAt: now(),
                },
              }
            }
            if (!parentContract || selectedBranch.headContractUuid !== parentContract.uuid) {
              return {
                draftReview: {
                  uuid: crypto.randomUUID(),
                  verdict: 'fail',
                  summary: '行为路径只能从它最新的已完成记录继续。',
                  missingRequirements: ['请从该路径末端继续，或从其它完成记录拆分新路径。'],
                  createdAt: now(),
                },
              }
            }
          } else if (parentContract) {
            const parentBranch = get().branches.find((branch) => branch.uuid === parentContract.branchUuid)
            const canExtend =
              !input.fork &&
              parentBranch?.projectUuid === project.uuid &&
              parentBranch.headContractUuid === parentContract.uuid &&
              !currentContractForBranch(parentBranch, allContracts)
            if (canExtend) selectedBranch = parentBranch
            else shouldCreateBranch = true
          } else {
            shouldCreateBranch = true
          }

          if (selectedBranch && currentContractForBranch(selectedBranch, allContracts) && !isReplacementSource) {
            return {
              draftReview: {
                uuid: crypto.randomUUID(),
                verdict: 'fail',
                summary: '这条行为路径还有一项承诺尚未结算。',
                missingRequirements: ['请先结算当前承诺，或从其它已完成记录拆分新路径。'],
                createdAt: now(),
              },
            }
          }
        }

        const localDraft = buildDraftReview(input.draft)
        const compiled = localDraft.compiled
        if (localDraft.review.verdict === 'fail') return { draftReview: localDraft.review }
        if (!input.draftReview) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '节点草案需要 AI 审核后才能创建。',
              missingRequirements: ['请使用页面上的“AI 审核并创建推进节点”完成审核。'],
              createdAt: now(),
            },
          }
        }
        const draftReview = input.draftReview
        if (draftReview.verdict === 'fail') return { draftReview }

        const criteria = compiled.acceptanceCriteria
        if (!get().accessToken) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: '请先登录后再创建推进节点。',
              missingRequirements: ['登录后才能把节点与 AI 审查结果写入项目链。'],
              createdAt: now(),
            },
          }
        }
        try {
          const snapshot = await createExecutionNode(get().accessToken, {
              projectUuid: project.uuid,
              draft: input.draft.trim(),
              draftReview,
              title: compiled.title,
              verifiableGoal: compiled.verifiableGoal,
              acceptanceCriteria: criteria.map((criterion, index) => ({
                id: `c${index + 1}`,
                text: criterion,
                requiredEvidence: `C${index + 1}：提交能直接证明“${criterion}”的结果、链接、截图说明或前后对比。`,
              })),
              evidenceRequirement: compiled.evidenceRequirement,
              parentContractUuid: parentContract?.uuid,
              sourceContractUuids: sourceIds,
              branchUuid: selectedBranch?.uuid,
              fork: shouldCreateBranch,
              closure: isClosure,
              supplementOfContractUuid: input.supplementOfContractUuid,
              retryOfContractUuid: input.retryOfContractUuid,
              planningConversationUuid: input.planningConversationUuid,
          })
          const created = snapshot.nodes.find((node) => node.originalIntent === input.draft.trim() && node.title === compiled.title)
          set((state) => mergeProjectState(state, snapshot))
          if (!created) throw new Error('节点已保存，但未能读取新节点编号。')
          return { contractUuid: created.uuid, draftReview }
        } catch (error) {
          return {
            draftReview: {
              uuid: crypto.randomUUID(),
              verdict: 'fail',
              summary: error instanceof Error ? error.message : '节点创建失败，请稍后重试。',
              missingRequirements: ['请检查后端服务，并重新提交已通过审核的草案。'],
              createdAt: now(),
            },
          }
        }
      },
      ...createCompletionActions(set, get),
      ...createSessionActions(set, get),
    }),
    {
      name: 'exec-graph-session',
      version: 19,
      // 旧版本持久化的是演示项目和本地密码。升级后只保留服务端令牌，工作区
      // 会在 AppShell 通过 refreshWorkspace 从后端重新读取。
      migrate: (persistedState) => {
        const token = typeof (persistedState as { accessToken?: unknown })?.accessToken === 'string'
          ? (persistedState as { accessToken: string }).accessToken
          : ''
        return { accessToken: token, isAuthenticated: Boolean(token) }
      },
      partialize: (state) => ({ accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    },
  ),
)
