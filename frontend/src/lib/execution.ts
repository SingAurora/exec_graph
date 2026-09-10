import type { CompletionRecord, ContractStage, ExecutionBranch, ExecutionContract, Project } from '../types'

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
  const visibleProjects = projectID ? projects.filter((project) => project.id === projectID) : projects
  const visibleProjectIDs = new Set(visibleProjects.map((project) => project.id))

  return new Set([
    ...visibleProjects.flatMap((project) => project.currentContractId ?? ''),
    ...branches
      .filter((branch) => visibleProjectIDs.has(branch.projectId))
      .flatMap((branch) => branch.currentContractId ?? ''),
  ])
}

export function completionRecordForContract(records: CompletionRecord[], contract: ExecutionContract) {
  return contract.completionRecordId
    ? records.find((record) => record.id === contract.completionRecordId)
    : records.find((record) => record.coveredContractIds.includes(contract.id))
}

export function nextActionLabel(contract: ExecutionContract) {
  if (contract.stage === 'verified') return '确认验收'
  if (contract.stage === 'needs_supplement') return '处理缺口'
  if (isReviewInProgress(contract)) return '查看提交'
  return '提交推进结果'
}
