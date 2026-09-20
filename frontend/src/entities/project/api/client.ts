import { getJSON, postJSON, withQuery } from '@/shared/api/client'
import type { Project } from '../model/types'
import type { CreateProjectInput, ProjectStateSnapshot, UpdateProjectProfileInput } from './dto'
import type { CreateExecutionNodeInput } from '@/entities/execution-node/api/dto'

export const createProject = (accessToken: string, input: CreateProjectInput) =>
  postJSON<Project>('/api/commands/projects/create-project', input, accessToken)

export const listOwnedProjects = (accessToken: string) =>
  getJSON<{ projects?: Project[] }>('/api/commands/projects/list-owned-projects', accessToken)

export const getProjectExecutionGraph = (accessToken: string, projectUuid: string) =>
  getJSON<ProjectStateSnapshot>(withQuery('/api/commands/projects/get-project-execution-graph', { projectUuid }), accessToken)

export const updateProjectProfile = (accessToken: string, projectUuid: string, input: UpdateProjectProfileInput) =>
  postJSON<ProjectStateSnapshot>('/api/commands/projects/update-project-profile', { projectUuid, ...input }, accessToken)

export const setProjectSmartContract = (accessToken: string, projectUuid: string, smartContractUuid: string) =>
  postJSON<ProjectStateSnapshot>('/api/commands/projects/set-project-smart-contract', { projectUuid, smartContractUuid }, accessToken)

export const setProjectReviewAI = (accessToken: string, projectUuid: string, aiKeyUuid: string) =>
  postJSON<void>('/api/commands/projects/set-project-review-ai', { projectUuid, aiKeyUuid }, accessToken)

export const archiveProject = (accessToken: string, projectUuid: string) =>
  postJSON<void>('/api/commands/projects/archive-project', { projectUuid }, accessToken)

export const restoreArchivedProject = (accessToken: string, projectUuid: string) =>
  postJSON<void>('/api/commands/projects/restore-archived-project', { projectUuid }, accessToken)

export const deleteProject = (accessToken: string, projectUuid: string) =>
  postJSON<void>('/api/commands/projects/delete-project', { projectUuid }, accessToken)

export const confirmNodeCompletion = (accessToken: string, projectUuid: string, nodeUuid: string) =>
  postJSON<ProjectStateSnapshot>('/api/commands/projects/confirm-node-completion', { projectUuid, nodeUuid }, accessToken)

export const createExecutionNode = (accessToken: string, input: CreateExecutionNodeInput & Record<string, unknown>) =>
  postJSON<ProjectStateSnapshot>('/api/commands/projects/create-execution-node', input, accessToken)

export const publishCollaborationCall = (accessToken: string, projectUuid: string, targetContractUuid: string, title: string) =>
  postJSON<void>('/api/commands/projects/publish-collaboration-call', { projectUuid, targetContractUuid, title }, accessToken)
