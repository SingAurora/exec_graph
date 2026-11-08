import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActionExpression, sortActionsNewestFirst } from '../../../entities/action/lib/expressions'
import { getPublishedExpressions } from '../../../entities/action/lib/published'
import { filterAgreementParticipants, getSatisfiedAgreementResponses } from '../../../entities/action/lib/agreement-responses'
import { getActionReferences, type ActionReference } from '../../../entities/action/lib/references'
import type { GraphSearchCriteria } from '../model/types'
import type { UserProfile } from '../../../entities/profile/model/types'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { findSearchMatch } from '../../../shared/lib/search'

function matchRank(title: string, body: string, query: string): number {
  if (title.toLocaleLowerCase() === query.toLocaleLowerCase()) return 0
  if (findSearchMatch(title, query) !== -1) return 1
  return findSearchMatch(body, query) !== -1 ? 2 : -1
}

/** Searches only current graph documents; expression searches read effective route endpoints. */
export function searchGraphDocuments(actions: ActionNode[], graphUuid: string, query: string, mode: ActionDocumentMode, authorUuid?: string): ActionNode[] {
  const keyword = query.trim()
  if (!keyword && !authorUuid) return []
  const graphActions = actions.filter((node) => node.graphUuid === graphUuid)
  const candidates = mode === 'expression' ? getPublishedExpressions(graphActions) : sortActionsNewestFirst(graphActions)
  return candidates.filter((node) => !authorUuid || node.authorUuid === authorUuid).map((node) => {
    const markdown = mode === 'expression' ? getActionExpression(graphActions, node.uuid).markdown : node.objectiveMarkdown ?? node.markdown
    return { node, rank: keyword ? matchRank(node.title, getMarkdownSummary(markdown), keyword) : 0 }
  }).filter(({ rank }) => rank !== -1).sort((a, b) => a.rank - b.rank).map(({ node }) => node)
}

/** Searches satisfied exchanges between either direction of the selected participants within one graph. */
export function searchGraphAgreementResponses(actions: ActionNode[], graphUuid: string, criteria: GraphSearchCriteria): ActionReference[] {
  const keyword = criteria.keyword.trim()
  if (!keyword && !criteria.participantUuid && !criteria.otherParticipantUuid) return []
  const references = getSatisfiedAgreementResponses(getActionReferences(actions.filter((node) => node.graphUuid === graphUuid)))
  return filterAgreementParticipants(references, criteria.participantUuid, criteria.otherParticipantUuid)
    .filter((reference) => !keyword || matchRank(reference.target.title, getMarkdownSummary(reference.agreement.markdown), keyword) !== -1)
}

/** Searches participant nicknames, excluding people without an action in the current graph. */
export function searchGraphParticipants(actions: ActionNode[], users: UserProfile[], graphUuid: string, query: string): UserProfile[] {
  const keyword = query.trim()
  if (!keyword) return []
  const participantUuids = new Set(actions.filter((node) => node.graphUuid === graphUuid).map((node) => node.authorUuid))
  const seen = new Set<string>()
  return users.filter((user) => {
    if (!participantUuids.has(user.uuid) || seen.has(user.uuid)) return false
    seen.add(user.uuid)
    return true
  }).map((user) => ({ user, rank: matchRank(user.name, '', keyword) }))
    .filter(({ rank }) => rank !== -1).sort((a, b) => a.rank - b.rank).map(({ user }) => user)
}
