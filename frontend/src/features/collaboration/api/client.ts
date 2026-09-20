import type { AIReview, AcceptanceCriterion } from '@/entities/execution-node/model/types'
import { requestJSON } from '@/shared/api/client'

export type CollaborationTarget = {
  id: string
  title: string
  verifiableGoal: string
  acceptanceCriteria: AcceptanceCriterion[]
  evidenceRequirement: string
  stage: string
}

export type CollaborationCall = {
  id: string
  projectId: string
  projectTitle: string
  ownerName: string
  ownerUserId: string
  createdBy: number
  title: string
  status: 'open' | 'adopted' | 'closed'
  maxSubmissions: number
  submissionCount: number
  target: CollaborationTarget
  createdAt: string
}

export type CollaborationSubmission = {
  id: string
  callId: string
  sourceRecordId: string
  sourceTitle: string
  sourceSummary: string
  sourceProjectTitle: string
  contributorId: number
  contributorName: string
  contributorUserId: string
  mappingText: string
  note?: string
  status: 'submitted' | 'adopted' | 'withdrawn'
  createdAt: string
}

export type CollaborationReviewBatch = {
  id: string
  callId: string
  submissionIds: string[]
  review: AIReview
  status: 'reviewed_pass' | 'reviewed_gap' | 'adopted'
  createdAt: string
  adoptedAt?: string
}

export type ExploreProject = {
  id: string
  title: string
  description: string
  ownerName: string
  ownerUserId: string
  nodeCount: number
  acceptedCount: number
  openCallCount: number
  calls: CollaborationCall[]
}

export type ContributionSource = { id: string; title: string; summary: string; projectTitle: string }
export type ContributionActivity = { submission: CollaborationSubmission; call: CollaborationCall }
export type PublicNetworkNode = {
  id: string
  kind: 'person' | 'project' | 'record'
  label: string
  detail: string
  projectId?: string
  recordId?: string
  userId?: string
  weight: number
  hasOpenCall: boolean
  isCurrentUser: boolean
}
export type PublicNetworkEdge = {
  id: string
  source: string
  target: string
  type: 'maintains' | 'authored' | 'result' | 'contributing' | 'adopted' | 'workspace'
  label: string
  detail?: string
  recordId?: string
  callId?: string
  sourceProjectId?: string
  targetProjectId?: string
  sourceProjectTitle?: string
  targetProjectTitle?: string
  createdAt: string
}
export type PublicNetwork = { nodes: PublicNetworkNode[]; edges: PublicNetworkEdge[] }

async function request<T>(token: string | undefined, path: string, init?: RequestInit): Promise<T> {
  return requestJSON<T>(path, { ...init, accessToken: token })
}

export const getExploreProjects = (token?: string) => request<{ projects: ExploreProject[] }>(token, '/api/commands/explore/projects/list', { method: 'GET' })
export const getExploreNetwork = (token?: string) => request<PublicNetwork>(token, '/api/commands/explore/network/get', { method: 'GET' })
export const getExploreProject = (token: string | undefined, projectId: string) => request<{ project: ExploreProject }>(token, `/api/commands/explore/projects/get?projectId=${encodeURIComponent(projectId)}`, { method: 'GET' })
export const getCall = (token: string, callId: string) => request<{ call: CollaborationCall; submissions: CollaborationSubmission[] }>(token, `/api/commands/collaboration/get?callId=${encodeURIComponent(callId)}`, { method: 'GET' })
export const getContributionSources = (token: string) => request<{ sources: ContributionSource[] }>(token, '/api/commands/explore/contribution-sources/list', { method: 'GET' })
export const getMyContributions = (token: string) => request<{ contributions: ContributionActivity[] }>(token, '/api/commands/explore/my-contributions/list', { method: 'GET' })
export const submitContribution = (token: string, callId: string, sourceRecordId: string, mappingText: string, note: string) => request<{ submissions: CollaborationSubmission[] }>(token, '/api/commands/collaboration/submit', { body: JSON.stringify({ callId, sourceRecordId, mappingText, note }) })
export const reviewContributions = (token: string, callId: string, submissionIds: string[]) => request<{ batch: CollaborationReviewBatch }>(token, '/api/commands/collaboration/review', { body: JSON.stringify({ callId, submissionIds }) })
export const adoptContributionReview = (token: string, reviewId: string) => request<{ message: string }>(token, '/api/commands/collaboration/adopt', { body: JSON.stringify({ batchId: reviewId }) })
