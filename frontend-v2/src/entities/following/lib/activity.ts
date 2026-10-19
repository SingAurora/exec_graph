import type { ActionNode } from '../../action/model/types'
import { getActionReferences } from '../../action/lib/references'
import { getReferenceAgreementAuthorId, getSatisfiedAgreementResponses } from '../../action/lib/agreement-responses'
import type { Project } from '../../../shared/model'
import type { FollowedSources } from '../model/types'

/** A public graph becomes followable only after its first published action. */
export function canFollowGraph(id: string, projects: Project[], actions: ActionNode[]): boolean {
  return projects.some((project) => project.id === id) && actions.some((node) => node.projectId === id)
}

/** Unions subscriptions without duplicating nodes or arrows; resolves agreement origins in full context. */
export function getFollowedActivity(actions: ActionNode[], sources: FollowedSources) {
  const graphs = new Set(sources.graphIds)
  const users = new Set(sources.userIds)
  return {
    actions: actions.filter((node) => graphs.has(node.projectId) || users.has(node.authorId)),
    agreementResponses: getSatisfiedAgreementResponses(getActionReferences(actions)).filter((reference) => graphs.has(reference.target.projectId)
      || users.has(reference.target.authorId) || users.has(getReferenceAgreementAuthorId(reference))),
  }
}
