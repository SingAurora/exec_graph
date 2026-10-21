import { getActionExpression } from './expressions'
import { getReferenceAgreementAuthorId } from './agreement-responses'
import type { ActionReference } from './references'
import type { ActionNode } from '../model/types'
import type { UserProfile } from '../../profile/model/types'
import { getMarkdownSummary } from '../../../shared/lib/markdownSummary'
import { findSearchMatch } from '../../../shared/lib/search'

function matches(query: string, ...fields: string[]): boolean {
  return !query.trim() || fields.some((field) => findSearchMatch(field, query) !== -1)
}

/** Filters current expressions by content, latest action and authors, preserving publication order. */
export function searchExpressions(candidates: ActionNode[], actions: ActionNode[], users: UserProfile[], query: string): ActionNode[] {
  if (!query.trim()) return candidates
  const names = new Map(users.map((user) => [user.id, user.name]))
  return candidates.filter((node) => {
    const context = actions.filter((action) => action.projectId === node.projectId)
    const expression = getActionExpression(context, node.id)
    const sourceAuthor = expression.sourceNode?.expressionSupplement?.authorId ?? expression.sourceNode?.authorId
    return matches(query, node.title, getMarkdownSummary(expression.markdown), names.get(node.authorId) ?? '', names.get(sourceAuthor ?? '') ?? '')
  })
}

/** Searches satisfied exchanges by the agreement, responding action and actual participants. */
export function searchAgreementResponses(candidates: ActionReference[], users: UserProfile[], query: string): ActionReference[] {
  if (!query.trim()) return candidates
  const names = new Map(users.map((user) => [user.id, user.name]))
  return candidates.filter((reference) => matches(query, getMarkdownSummary(reference.agreement.markdown), reference.target.title,
    names.get(reference.target.authorId) ?? '', names.get(getReferenceAgreementAuthorId(reference)) ?? ''))
}

/** Searches supplied actions by title, factual document and author, excluding dialogue and expressions. */
export function searchActions(candidates: ActionNode[], users: UserProfile[], query: string): ActionNode[] {
  if (!query.trim()) return candidates
  const names = new Map(users.map((user) => [user.id, user.name]))
  return candidates.filter((node) => matches(query, node.title, getMarkdownSummary(node.objectiveMarkdown ?? node.markdown), names.get(node.authorId) ?? ''))
}
