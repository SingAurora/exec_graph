import type { ActionDocumentMode, ActionNode } from '../../../entities/action/model/types'
import { getActionExpression, sortActionsNewestFirst } from '../../../entities/action/lib/expressions'
import { getPublishedExpressions } from '../../../entities/action/lib/published'
import type { UserProfile } from '../../../shared/model'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { findSearchMatch } from '../../../shared/lib/search'

function matchRank(title: string, body: string, query: string): number {
  if (title.toLocaleLowerCase() === query.toLocaleLowerCase()) return 0
  if (findSearchMatch(title, query) !== -1) return 1
  return findSearchMatch(body, query) !== -1 ? 2 : -1
}

/** Searches only current graph documents; expression searches read effective route endpoints. */
export function searchGraphDocuments(actions: ActionNode[], projectId: string, query: string, mode: ActionDocumentMode): ActionNode[] {
  const keyword = query.trim()
  if (!keyword) return []
  const graphActions = actions.filter((node) => node.projectId === projectId)
  const candidates = mode === 'expression' ? getPublishedExpressions(graphActions) : sortActionsNewestFirst(graphActions)
  return candidates.map((node) => {
    const markdown = mode === 'expression' ? getActionExpression(graphActions, node.id).markdown : node.objectiveMarkdown ?? node.markdown
    return { node, rank: matchRank(node.title, getMarkdownSummary(markdown), keyword) }
  }).filter(({ rank }) => rank !== -1).sort((a, b) => a.rank - b.rank).map(({ node }) => node)
}

/** Searches participant nicknames, excluding people without an action in the current graph. */
export function searchGraphParticipants(actions: ActionNode[], users: UserProfile[], projectId: string, query: string): UserProfile[] {
  const keyword = query.trim()
  if (!keyword) return []
  const participantIds = new Set(actions.filter((node) => node.projectId === projectId).map((node) => node.authorId))
  const seen = new Set<string>()
  return users.filter((user) => {
    if (!participantIds.has(user.id) || seen.has(user.id)) return false
    seen.add(user.id)
    return true
  }).map((user) => ({ user, rank: matchRank(user.name, '', keyword) }))
    .filter(({ rank }) => rank !== -1).sort((a, b) => a.rank - b.rank).map(({ user }) => user)
}
