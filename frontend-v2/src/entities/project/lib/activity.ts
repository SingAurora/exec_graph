import { sortActionsNewestFirst } from '../../action/lib/expressions'
import { getPublishedExpressions } from '../../action/lib/published'
import type { ActionNode } from '../../action/model/types'
import type { Project } from '../../../shared/model'
import type { GraphActivity } from '../model/types'

/** Uses actual published contributions instead of the obsolete participant list. */
export function hasUserContributed(projectId: string, userId: string, actions: ActionNode[]): boolean {
  return actions.some((node) => node.projectId === projectId && node.authorId === userId)
}

/** Summarizes public actions and nonempty expressions at current route endpoints. */
export function getGraphActivity(project: Project, actions: ActionNode[]): GraphActivity {
  const nodes = actions.filter((node) => node.projectId === project.id)
  return {
    project,
    actionCount: nodes.length,
    expressionCount: getPublishedExpressions(nodes).length,
    participantCount: new Set(nodes.map((node) => node.authorId)).size,
    lastActionAt: sortActionsNewestFirst(nodes)[0]?.createdAt,
  }
}

