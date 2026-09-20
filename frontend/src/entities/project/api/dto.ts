import type { CompletionRecord, ExecutionBranch, ExecutionContract, ExecutionEdge } from '@/entities/execution-node/model/types'
import type { Project, ProjectType, ProjectVisibility } from '../model/types'

/** 项目创建接口的稳定输入。 */
export type CreateProjectInput = {
  title: string
  description: string
  projectType: ProjectType
  projectRules: string
  smartContractUuid: string
  visibility: ProjectVisibility
  aiKeyUuid: string
  contributionCallUuid?: string
}

/** 项目资料编辑接口的稳定输入。 */
export type UpdateProjectProfileInput = Pick<Project, 'title' | 'description' | 'visibility'>

/** 一次项目图谱读取或写入后的完整快照。 */
export type ProjectStateSnapshot = {
  project: Project
  nodes: ExecutionContract[]
  edges: ExecutionEdge[]
  branches: ExecutionBranch[]
  completionRecords: CompletionRecord[]
}
