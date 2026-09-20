import { isActionableStage } from '@/entities/execution-node/model/selectors'
import type { CompletionRecord, ExecutionBranch, ExecutionContract, ExecutionEdge } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'
import type { ProjectStateResponse, WorkspaceState } from './dto'

export const normalizeExecutionContract = (contract: ExecutionContract): ExecutionContract => ({
  ...contract,
  actorId: contract.actorId === undefined || contract.actorId === null ? undefined : String(contract.actorId),
})

export const mergeProjectState = (
  state: Pick<WorkspaceState, 'projects' | 'contracts' | 'branches' | 'completionRecords' | 'edges'>,
  snapshot: ProjectStateResponse,
) => ({
  projects: state.projects.map((project) => (project.id === snapshot.project.id ? snapshot.project : project)),
  contracts: [...state.contracts.filter((contract) => contract.projectId !== snapshot.project.id), ...snapshot.nodes.map(normalizeExecutionContract)],
  branches: [...state.branches.filter((branch) => branch.projectId !== snapshot.project.id), ...snapshot.branches],
  completionRecords: [...state.completionRecords.filter((record) => record.projectId !== snapshot.project.id), ...snapshot.completionRecords],
  edges: [
    ...state.edges.filter(
      (edge) =>
        !state.contracts.some(
          (contract) => contract.projectId === snapshot.project.id && (contract.id === edge.sourceContractId || contract.id === edge.targetContractId),
        ),
    ),
    ...snapshot.edges,
  ],
})

export const currentRevision = (project: Project) =>
  project.contractRevisions.find((revision) => revision.id === project.activeContractRevisionId) ?? project.contractRevisions[0]

export const currentContractForProject = (project: Project, allContracts: ExecutionContract[]) => {
  if (!project.currentContractId) return undefined
  const contract = allContracts.find((item) => item.id === project.currentContractId && item.projectId === project.id)
  return contract && isActionableStage(contract.stage) ? contract : undefined
}

export const currentContractForBranch = (branch: ExecutionBranch, allContracts: ExecutionContract[]) => {
  if (!branch.currentContractId) return undefined
  const contract = allContracts.find((item) => item.id === branch.currentContractId && item.branchId === branch.id)
  return contract && isActionableStage(contract.stage) ? contract : undefined
}

export const isCurrentContract = (
  project: Project,
  contract: ExecutionContract,
  allContracts: ExecutionContract[],
  allBranches: ExecutionBranch[],
) => {
  if (currentContractForProject(project, allContracts)?.id === contract.id) return true
  const branch = allBranches.find((item) => item.id === contract.branchId && item.projectId === project.id)
  return branch ? currentContractForBranch(branch, allContracts)?.id === contract.id : false
}

export const normalizeProject = (project: Project): Project => ({
  ...project,
  visibility: project.visibility ?? 'private',
  projectType: project.projectType ?? 'guided',
  projectRules: project.projectRules ?? '',
  currentContractId: project.currentContractId,
})

export type WorkspaceStateCollections = Pick<WorkspaceState, 'projects' | 'contracts' | 'branches' | 'completionRecords' | 'edges'>

export type { CompletionRecord, ExecutionBranch, ExecutionContract, ExecutionEdge }
