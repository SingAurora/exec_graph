import type { ActionNode } from '../../action/model/types'
import type { Project } from '../../../shared/model'

/** Includes the creator, declared participants, and authors within this graph. */
export function isProjectParticipant(project: Project, userId: string, actions: ActionNode[]): boolean {
  return project.ownerId === userId || project.participantIds.includes(userId)
    || actions.some((node) => node.projectId === project.id && node.authorId === userId)
}

/** Shared explanation used by the disabled control and the deletion eligibility check. */
export function getProjectDeletionDisabledReason(project: Project, userId: string, actions: ActionNode[]): string | undefined {
  if (!isProjectParticipant(project, userId, actions)) return '只有参与此图的用户可以删除'
  const participantIds = new Set([project.ownerId, ...project.participantIds,
    ...actions.filter((node) => node.projectId === project.id).map((node) => node.authorId),
  ])
  if (participantIds.size >= 2) return '已有其他用户参与，不能删除此图'
  return undefined
}

/** Deletion is limited to graphs with no participants other than the current user. */
export function canDeleteProject(project: Project, userId: string, actions: ActionNode[]): boolean {
  return getProjectDeletionDisabledReason(project, userId, actions) === undefined
}
