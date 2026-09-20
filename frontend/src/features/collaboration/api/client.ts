import type { AIReview, AcceptanceCriterion } from '@/entities/execution-node/model/types'
import { requestJSON } from '@/shared/api/client'

export type CollaborationTarget = {
  uuid: string
  title: string
  verifiableGoal: string
  acceptanceCriteria: AcceptanceCriterion[]
  evidenceRequirement: string
  stage: string
}

export type CollaborationCall = {
  uuid: string
  projectUuid: string
  projectTitle: string
  ownerName: string
  ownerUserId: string
  createdByUserId: string
  title: string
  status: 'open' | 'adopted' | 'closed'
  maxSubmissions: number
  submissionCount: number
  target: CollaborationTarget
  createdAt: string
}

export type CollaborationSubmission = {
  uuid: string
  callUuid: string
  sourceRecordUuid: string
  sourceTitle: string
  sourceSummary: string
  sourceProjectTitle: string
  contributorName: string
  contributorUserId: string
  mappingText: string
  note?: string
  status: 'submitted' | 'adopted' | 'withdrawn'
  createdAt: string
}

export type CollaborationReviewBatch = {
  uuid: string
  callUuid: string
  submissionUuids: string[]
  review: AIReview
  status: 'reviewed_pass' | 'reviewed_gap' | 'adopted'
  createdAt: string
  adoptedAt?: string
}

export type ExploreProject = {
  uuid: string
  title: string
  description: string
  ownerName: string
  ownerUserId: string
  nodeCount: number
  acceptedCount: number
  openCallCount: number
  calls: CollaborationCall[]
}

export type ContributionSource = { uuid: string; title: string; summary: string; projectTitle: string }
export type ContributionActivity = { submission: CollaborationSubmission; call: CollaborationCall }
export type PublicNetworkNode = {
  key: string
  kind: 'person' | 'project' | 'record'
  label: string
  detail: string
  projectUuid?: string
  recordUuid?: string
  userId?: string
  weight: number
  hasOpenCall: boolean
  isCurrentUser: boolean
}
export type PublicNetworkEdge = {
  key: string
  source: string
  target: string
  type: 'maintains' | 'authored' | 'result' | 'contributing' | 'adopted' | 'workspace'
  label: string
  detail?: string
  recordUuid?: string
  callUuid?: string
  sourceProjectUuid?: string
  targetProjectUuid?: string
  sourceProjectTitle?: string
  targetProjectTitle?: string
  createdAt: string
}
export type PublicNetwork = { nodes: PublicNetworkNode[]; edges: PublicNetworkEdge[] }

async function request<T>(token: string | undefined, path: string, init?: RequestInit): Promise<T> {
  return requestJSON<T>(path, { ...init, accessToken: token })
}

export const listPublicProjects = (token?: string) => request<{ projects: ExploreProject[] }>(token, '/api/commands/explore/list-public-projects', { method: 'GET' })
export const getPublicCollaborationNetwork = (token?: string) => request<PublicNetwork>(token, '/api/commands/explore/get-public-collaboration-network', { method: 'GET' })
export const getPublicProjectDetail = (token: string | undefined, projectUuid: string) => request<{ project: ExploreProject }>(token, `/api/commands/explore/get-public-project-detail?projectUuid=${encodeURIComponent(projectUuid)}`, { method: 'GET' })
export const getCollaborationCallDetail = (token: string, callUuid: string) => request<{ call: CollaborationCall; submissions: CollaborationSubmission[] }>(token, `/api/commands/collaboration/get-collaboration-call-detail?callUuid=${encodeURIComponent(callUuid)}`, { method: 'GET' })
export const listContributionSourceRecords = (token: string) => request<{ sources: ContributionSource[] }>(token, '/api/commands/explore/list-contribution-source-records', { method: 'GET' })
export const listCurrentUserContributions = (token: string) => request<{ contributions: ContributionActivity[] }>(token, '/api/commands/explore/list-current-user-contributions', { method: 'GET' })
export const submitProjectContribution = (token: string, callUuid: string, sourceRecordUuid: string, mappingText: string, note: string) => request<{ submissions: CollaborationSubmission[] }>(token, '/api/commands/collaboration/submit-project-contribution', { body: JSON.stringify({ callUuid, sourceRecordUuid, mappingText, note }) })
export const reviewContributionBatch = (token: string, callUuid: string, submissionUuids: string[]) => request<{ batch: CollaborationReviewBatch }>(token, '/api/commands/collaboration/review-contribution-batch', { body: JSON.stringify({ callUuid, submissionUuids }) })
export const adoptReviewedContributions = (token: string, reviewUuid: string) => request<{ message: string }>(token, '/api/commands/collaboration/adopt-reviewed-contributions', { body: JSON.stringify({ batchUuid: reviewUuid }) })
