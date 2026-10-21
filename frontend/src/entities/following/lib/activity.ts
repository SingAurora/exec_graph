import type { ActionNode } from '../../action/model/types'
import { getActionReferences, type ActionReference } from '../../action/lib/references'
import { getReferenceAgreementAuthorId, getSatisfiedAgreementResponses } from '../../action/lib/agreement-responses'
import { getPublishedExpressions } from '../../action/lib/published'
import { sortActionsNewestFirst } from '../../action/lib/expressions'
import type { Project } from '../../project/model/types'
import type { FollowedSources } from '../model/types'

/** A public graph becomes followable only after its first published action. */
export function canFollowGraph(id: string, projects: Project[], actions: ActionNode[]): boolean {
  return projects.some((project) => project.id === id) && actions.some((node) => node.projectId === id)
}

/** Unions subscriptions without duplicating nodes or arrows; resolves agreement origins in full context. */
export function getFollowedActivity(actions: ActionNode[], sources: FollowedSources) {
  const graphs = new Set(sources.graphIds)
  const users = new Set(sources.userIds)
  const followedActions = actions.filter((node) => graphs.has(node.projectId) || users.has(node.authorId))
  const includedIds = new Set(followedActions.map((node) => node.id))
  return {
    actions: sortActionsNewestFirst(followedActions),
    expressions: getPublishedExpressions(actions).filter((node) => includedIds.has(node.id))
      .sort((a, b) => expressionUpdatedAt(b) - expressionUpdatedAt(a) || b.number - a.number),
    agreementResponses: getSatisfiedAgreementResponses(getActionReferences(actions)).filter((reference) => graphs.has(reference.target.projectId)
      || users.has(reference.target.authorId) || users.has(getReferenceAgreementAuthorId(reference))),
  }
}

/** Explains an unfamiliar responder only when a followed agreement author brought the response into the feed. */
export function getFollowedAgreementRecipient(reference: ActionReference, sources: FollowedSources): string | undefined {
  if (sources.graphIds.includes(reference.target.projectId) || sources.userIds.includes(reference.target.authorId)) return
  const authorId = getReferenceAgreementAuthorId(reference)
  return sources.userIds.includes(authorId) ? authorId : undefined
}

function expressionUpdatedAt(node: ActionNode): number {
  return Math.max(Date.parse(node.createdAt) || 0, Date.parse(node.expressionSupplement?.createdAt ?? '') || 0)
}
