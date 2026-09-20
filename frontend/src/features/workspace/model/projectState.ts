import { isActionableStage } from '@/entities/execution-node/model/selectors'
import type { CompletionRecord, ExecutionBranch, ExecutionContract, ExecutionEdge } from '@/entities/execution-node/model/types'
import type { Project } from '@/entities/project/model/types'
import type { ProjectStateSnapshot } from '@/entities/project/api/dto'
import type { WorkspaceState } from './dto'

export const normalizeExecutionContract = (contract: ExecutionContract): ExecutionContract => ({
  ...contract,
  actorUserId: contract.actorUserId,
})

export const mergeProjectState = (
  state: Pick<WorkspaceState, 'projects' | 'contracts' | 'branches' | 'completionRecords' | 'edges'>,
  snapshot: ProjectStateSnapshot,
) => ({
  projects: state.projects.map((project) => (project.uuid === snapshot.project.uuid ? snapshot.project : project)),
  contracts: [...state.contracts.filter((contract) => contract.projectUuid !== snapshot.project.uuid), ...snapshot.nodes.map(normalizeExecutionContract)],
  branches: [...state.branches.filter((branch) => branch.projectUuid !== snapshot.project.uuid), ...snapshot.branches],
  completionRecords: [...state.completionRecords.filter((record) => record.projectUuid !== snapshot.project.uuid), ...snapshot.completionRecords],
  edges: [
    ...state.edges.filter(
      (edge) =>
        !state.contracts.some(
          (contract) => contract.projectUuid === snapshot.project.uuid && (contract.uuid === edge.sourceContractUuid || contract.uuid === edge.targetContractUuid),
        ),
    ),
    ...snapshot.edges,
  ],
})

export const currentRevision = (project: Project) =>
  project.contractRevisions.find((revision) => revision.uuid === project.activeContractRevisionUuid) ?? project.contractRevisions[0]

export const currentContractForProject = (project: Project, allContracts: ExecutionContract[]) => {
  if (!project.currentContractUuid) return undefined
  const contract = allContracts.find((item) => item.uuid === project.currentContractUuid && item.projectUuid === project.uuid)
  return contract && isActionableStage(contract.stage) ? contract : undefined
}

export const currentContractForBranch = (branch: ExecutionBranch, allContracts: ExecutionContract[]) => {
  if (!branch.currentContractUuid) return undefined
  const contract = allContracts.find((item) => item.uuid === branch.currentContractUuid && item.branchUuid === branch.uuid)
  return contract && isActionableStage(contract.stage) ? contract : undefined
}

export const isCurrentContract = (
  project: Project,
  contract: ExecutionContract,
  allContracts: ExecutionContract[],
  allBranches: ExecutionBranch[],
) => {
  if (currentContractForProject(project, allContracts)?.uuid === contract.uuid) return true
  const branch = allBranches.find((item) => item.uuid === contract.branchUuid && item.projectUuid === project.uuid)
  return branch ? currentContractForBranch(branch, allContracts)?.uuid === contract.uuid : false
}

export const normalizeProject = (project: Project): Project => ({
  ...project,
  visibility: project.visibility ?? 'private',
  projectType: project.projectType ?? 'guided',
  projectRules: project.projectRules ?? '',
  currentContractUuid: project.currentContractUuid,
})

export type WorkspaceStateCollections = Pick<WorkspaceState, 'projects' | 'contracts' | 'branches' | 'completionRecords' | 'edges'>

export type { CompletionRecord, ExecutionBranch, ExecutionContract, ExecutionEdge }
