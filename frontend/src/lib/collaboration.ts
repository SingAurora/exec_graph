import type { AcceptanceCriterion, AIReview } from '../types'

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
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(path, {
    ...init,
    headers,
  })
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(data.error ?? `请求失败（HTTP ${response.status}）`)
  return data
}

export const getExploreProjects = (token?: string) => request<{ projects: ExploreProject[] }>(token, '/api/explore/projects')
export const getExploreNetwork = (token?: string) => request<PublicNetwork>(token, '/api/explore/network')
export const getExploreProject = (token: string | undefined, projectId: string) => request<{ project: ExploreProject }>(token, `/api/explore/projects/${projectId}`)
export const getCall = (token: string, callId: string) => request<{ call: CollaborationCall; submissions: CollaborationSubmission[] }>(token, `/api/collaboration-calls/${callId}`)
export const getContributionSources = (token: string) => request<{ sources: ContributionSource[] }>(token, '/api/explore/contribution-sources')
export const getMyContributions = (token: string) => request<{ contributions: ContributionActivity[] }>(token, '/api/explore/my-contributions')
export const submitContribution = (token: string, callId: string, sourceRecordId: string, mappingText: string, note: string) => request<{ submissions: CollaborationSubmission[] }>(token, `/api/collaboration-calls/${callId}/submissions`, { method: 'POST', body: JSON.stringify({ sourceRecordId, mappingText, note }) })
export const reviewContributions = (token: string, callId: string, submissionIds: string[]) => request<{ batch: CollaborationReviewBatch }>(token, `/api/collaboration-calls/${callId}/reviews`, { method: 'POST', body: JSON.stringify({ submissionIds }) })
export const adoptContributionReview = (token: string, reviewId: string) => request<{ message: string }>(token, `/api/collaboration-calls/reviews/${reviewId}/adopt`, { method: 'POST' })
