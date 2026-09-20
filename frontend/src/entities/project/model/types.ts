import type { AcceptanceCriterion } from '@/entities/execution-node/model/types'
import type { SmartContractDefinition } from '@/entities/smart-contract/model/types'

export type ProjectVisibility = 'private' | 'public'
export type ProjectType = 'guided' | 'autonomous'

export type ProjectContractRevision = {
  id: string
  smartContractId: string
  smartContractVersion: string
  reason: string
  activatedAt: string
  smartContract?: SmartContractDefinition
}

export type ContributionOrigin = {
  callId: string
  projectId: string
  projectTitle: string
  callTitle: string
  status: 'open' | 'adopted' | 'closed'
  targetTitle: string
  verifiableGoal: string
  acceptanceCriteria: AcceptanceCriterion[]
  evidenceRequirement: string
  availableSources: Array<{ title: string; projectTitle: string; mappingText: string; status: 'submitted' | 'adopted' }>
}

export type Project = {
  id: string
  title: string
  description: string
  isDefault: boolean
  visibility: ProjectVisibility
  projectType: ProjectType
  projectRules: string
  reviewAIKeyId?: string
  contributionOrigin?: ContributionOrigin
  currentContractId?: string | null
  activeContractRevisionId: string
  contractRevisions: ProjectContractRevision[]
  createdAt: string
  archivedAt?: string
}
