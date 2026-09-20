import type { AcceptanceCriterion } from '@/entities/execution-node/model/types'
import type { SmartContractDefinition } from '@/entities/smart-contract/model/types'

export type ProjectVisibility = 'private' | 'public'
export type ProjectType = 'guided' | 'autonomous'

export type ProjectContractRevision = {
  uuid: string
  smartContractUuid: string
  smartContractVersion: string
  reason: string
  activatedAt: string
  smartContract?: SmartContractDefinition
}

export type ContributionOrigin = {
  callUuid: string
  projectUuid: string
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
  uuid: string
  title: string
  description: string
  isDefault: boolean
  visibility: ProjectVisibility
  projectType: ProjectType
  projectRules: string
  reviewAIKeyUuid?: string
  contributionOrigin?: ContributionOrigin
  currentContractUuid?: string | null
  activeContractRevisionUuid: string
  contractRevisions: ProjectContractRevision[]
  createdAt: string
  archivedAt?: string
}
