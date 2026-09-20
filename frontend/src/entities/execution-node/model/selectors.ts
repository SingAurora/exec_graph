import type { Project } from '@/entities/project/model/types'
import type { CompletionRecord, ContractStage, ExecutionBranch, ExecutionContract } from './types'

export const isActionableStage = (stage: ContractStage) =>
  stage === 'frozen' || stage === 'verified' || stage === 'needs_supplement'

export const needsReviewDecision = (contract: ExecutionContract) =>
  contract.stage === 'verified' || contract.stage === 'needs_supplement'

export const isReviewInProgress = (contract: ExecutionContract) =>
  contract.stage === 'frozen' && Boolean(contract.completionClaim) && !contract.aiReview

export const isReadyToProgress = (contract: ExecutionContract) =>
  contract.stage === 'frozen' && !contract.completionClaim

export const isAcceptedRecord = (record: CompletionRecord) => record.recordKind === 'accepted'

export const isSealedRecord = (record: CompletionRecord) => record.recordKind === 'sealed'

export function currentContractIDs(projects: Project[], branches: ExecutionBranch[], projectID?: string) {
  const visibleProjects = projectID ? projects.filter((project) => project.uuid === projectID) : projects
  const visibleProjectIDs = new Set(visibleProjects.map((project) => project.uuid))

  return new Set([
    ...visibleProjects.flatMap((project) => project.currentContractUuid ?? ''),
    ...branches
      .filter((branch) => visibleProjectIDs.has(branch.projectUuid))
      .flatMap((branch) => branch.currentContractUuid ?? ''),
  ])
}

export function completionRecordForContract(records: CompletionRecord[], contract: ExecutionContract) {
  return contract.completionRecordUuid
    ? records.find((record) => record.uuid === contract.completionRecordUuid)
    : records.find((record) => record.coveredContractUuids.includes(contract.uuid))
}

export function nextActionLabel(contract: ExecutionContract) {
  if (contract.stage === 'verified') return '确认验收'
  if (contract.stage === 'needs_supplement') return '处理缺口'
  if (isReviewInProgress(contract)) return '查看提交'
  return '提交推进结果'
}
